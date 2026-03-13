import { App, Editor, EditorPosition, MarkdownView, Notice, Plugin } from 'obsidian';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { Completion } from '@codemirror/autocomplete';
import { FloatingMenu } from './FloatingMenu';
import { exportNoteWithQuarto } from './ExportHandler';
import { resolvePandocExecutable, resolveQuartoExecutable, resolveRExecutable } from './ExecutableUtils';
import { setupPathEnvironment } from './PathUtils';
import {
  EnvironmentVariable,
  getCurrentCodeChunk,
  NoteRSession,
  runCurrentCodeChunk,
  stopAllRSessions,
} from './RCodeEvaluator';
import { REnvironmentView, VIEW_TYPE_R_ENVIRONMENT } from './REnvironmentView';
import { RHelpView, VIEW_TYPE_R_HELP } from './RHelpView';
import { RLanguageServer } from './RLanguageServer';
import {
  CombinedPluginSettings,
  DEFAULT_SETTINGS,
  MyPluginSettingTab,
} from './SettingsTab';
import { SignatureHelpDropdown } from './SignatureHelpDropdown';
import { CompletionDropdown } from './modal';

interface EnvironmentSnapshot {
  notePath: string;
  noteTitle: string;
  variables: EnvironmentVariable[];
}

interface HelpSnapshot {
  notePath: string;
  noteTitle: string;
  helpContent: string;
}

export default class CombinedPlugin extends Plugin {
  settings: CombinedPluginSettings;
  floatingMenu: FloatingMenu;
  rSessions: Map<string, NoteRSession> = new Map();
  private rLanguageServer: RLanguageServer | null = null;
  private currentCompletions: Completion[] = [];
  private currentDropdown: CompletionDropdown | null = null;
  private signatureHelpDropdown: SignatureHelpDropdown | null = null;
  private isInsertingCompletion = false;
  private documentId = 1;
  private latestEnvironmentSnapshot: EnvironmentSnapshot | null = null;
  private latestHelpSnapshot: HelpSnapshot | null = null;

  async onload() {
    document.body.setAttribute('ridian', 'true');

    await this.loadSettings();
    setupPathEnvironment();

    this.floatingMenu = new FloatingMenu(this);
    if (this.settings.enableFloatingMenu) {
      this.floatingMenu.onLoad();
    }

    this.addSettingTab(new MyPluginSettingTab(this.app, this));
    this.registerView(VIEW_TYPE_R_ENVIRONMENT, (leaf) => new REnvironmentView(leaf, this));
    this.registerView(VIEW_TYPE_R_HELP, (leaf) => new RHelpView(leaf, this));

    this.app.workspace.onLayoutReady(() => {
      this.initializeViews();
    });

    this.registerCommands();
    this.startLanguageServer();
    this.registerEditorEvents();
  }

  onunload() {
    document.body.removeAttribute('ridian');
    this.floatingMenu.onUnload();
    this.closeCompletionDropdown();
    this.closeSignatureHelpDropdown();
    this.stopLanguageServer();
    stopAllRSessions(this);
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  public getResolvedRExecutablePath(): string | null {
    return resolveRExecutable(this.settings.rExecutablePath).resolvedPath;
  }

  public getResolvedQuartoExecutablePath(): string | null {
    return resolveQuartoExecutable(this.settings.quartoExecutablePath).resolvedPath;
  }

  public getResolvedPandocPath(): string | null {
    return resolvePandocExecutable(this.settings.rstudioPandocPath).resolvedPath;
  }

  public getLatestEnvironmentSnapshot() {
    return this.latestEnvironmentSnapshot;
  }

  public getLatestHelpSnapshot() {
    return this.latestHelpSnapshot;
  }

  public publishEnvironmentData(
    notePath: string,
    noteTitle: string,
    variables: EnvironmentVariable[]
  ) {
    this.latestEnvironmentSnapshot = {
      notePath,
      noteTitle,
      variables,
    };

    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_R_ENVIRONMENT)) {
      if (leaf.view instanceof REnvironmentView) {
        leaf.view.updateEnvironmentData(noteTitle, variables);
      }
    }
  }

  public publishHelpContent(notePath: string, noteTitle: string, helpContent: string) {
    this.latestHelpSnapshot = {
      notePath,
      noteTitle,
      helpContent,
    };

    for (const leaf of this.app.workspace.getLeavesOfType(VIEW_TYPE_R_HELP)) {
      if (leaf.view instanceof RHelpView) {
        leaf.view.updateHelpContent(helpContent);
      }
    }
  }

  public async updateRExecutablePath(value: string) {
    this.settings.rExecutablePath = value.trim();
    await this.saveSettings();
    this.startLanguageServer();
  }

  public async updatePandocPath(value: string) {
    this.settings.rstudioPandocPath = value.trim();
    await this.saveSettings();
  }

  public async updateQuartoExecutablePath(value: string) {
    this.settings.quartoExecutablePath = value.trim();
    await this.saveSettings();
  }

  public async setFloatingMenuEnabled(enabled: boolean) {
    this.settings.enableFloatingMenu = enabled;
    await this.saveSettings();

    if (enabled) {
      this.floatingMenu.onLoad();
    } else {
      this.floatingMenu.onUnload();
    }
  }

  public async toggleFloatingMenu() {
    await this.setFloatingMenuEnabled(!this.settings.enableFloatingMenu);
  }

  private initializeViews() {
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_R_ENVIRONMENT).length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        void leaf.setViewState({ type: VIEW_TYPE_R_ENVIRONMENT, active: true });
      }
    }

    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_R_HELP).length === 0) {
      const leaf = this.app.workspace.getRightLeaf(true);
      if (leaf) {
        void leaf.setViewState({ type: VIEW_TYPE_R_HELP, active: true });
      }
    }
  }

  private registerCommands() {
    this.addCommand({
      id: 'run-current-code-chunk',
      name: 'Run Current Code Chunk',
      editorCallback: (editor, view) => {
        if (!(view instanceof MarkdownView)) {
          new Notice('Current view is not a markdown view.');
          return;
        }

        if (!view.file) {
          new Notice('No file associated with the current view.');
          return;
        }

        void runCurrentCodeChunk(this, editor, view, view.file.basename);
      },
      hotkeys: [{ modifiers: ['Mod'], key: 'r' }],
    });

    this.addCommand({
      id: 'insert-r-code-chunk',
      name: 'Insert R Code Chunk',
      editorCallback: (editor) => {
        this.insertCodeBlock('r', editor);
      },
    });

    this.addCommand({
      id: 'toggle-floating-menu',
      name: 'Toggle Floating Menu',
      callback: () => {
        void this.toggleFloatingMenu();
      },
    });

    this.addCommand({
      id: 'export-note-with-quarto',
      name: 'Export Note with Quarto',
      callback: () => {
        void exportNoteWithQuarto(this);
      },
    });
  }

  private registerEditorEvents() {
    this.registerEditorExtension(
      EditorView.updateListener.of((update: ViewUpdate) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView?.editor) {
          return;
        }

        if (update.selectionSet) {
          this.handleCursorActivity(activeView.editor);
        }
      })
    );
  }

  private startLanguageServer() {
    this.stopLanguageServer();

    const rExecutablePath = this.getResolvedRExecutablePath();
    if (!rExecutablePath) {
      console.warn('R executable could not be resolved. Language server disabled.');
      return;
    }

    this.rLanguageServer = new RLanguageServer(rExecutablePath);
    this.rLanguageServer.start();
  }

  private stopLanguageServer() {
    if (!this.rLanguageServer) {
      return;
    }

    this.rLanguageServer.stop();
    this.rLanguageServer = null;
  }

  private nextDocumentId(): number {
    return this.documentId++;
  }

  private handleCompletion(items: any[]) {
    if (items.length === 0) {
      this.closeCompletionDropdown();
      return;
    }

    this.currentCompletions = items.map((item: any) => ({
      label: item.label || '',
      detail: item.detail || '',
      info:
        typeof item.documentation === 'string'
          ? item.documentation
          : item.documentation?.value || undefined,
      insertText: item.textEdit?.newText || item.insertText || item.label || '',
    }));

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    this.showCompletionDropdown(activeView.editor);
  }

  private showCompletionDropdown(editor: Editor) {
    if (this.currentCompletions.length === 0) {
      return;
    }

    this.closeCompletionDropdown();
    this.currentDropdown = new CompletionDropdown(
      this.app,
      editor,
      this.currentCompletions,
      (completion) => {
        const textToInsert = (completion as any).insertText || completion.label;
        this.insertCompletionAtCursor(editor, textToInsert);
        this.closeCompletionDropdown();
      }
    );
  }

  private closeCompletionDropdown() {
    if (!this.currentDropdown) {
      return;
    }

    this.currentDropdown.close();
    this.currentDropdown = null;
  }

  private insertCompletionAtCursor(editor: Editor, text: string) {
    this.isInsertingCompletion = true;

    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const wordStart = line.slice(0, cursor.ch).match(/[\w.]*$/)?.[0] || '';
    const wordEnd = line.slice(cursor.ch).match(/^[\w.]*/)?.[0] || '';
    const from = { line: cursor.line, ch: cursor.ch - wordStart.length };
    const to = { line: cursor.line, ch: cursor.ch + wordEnd.length };

    editor.replaceRange(text, from, to);
    editor.setCursor({ line: cursor.line, ch: from.ch + text.length });
    this.isInsertingCompletion = false;
  }

  private handleCursorActivity(editor: Editor) {
    if (this.isInsertingCompletion || !this.rLanguageServer) {
      return;
    }

    const cursor = editor.getCursor();
    const line = editor.getLine(cursor.line);
    const beforeCursor = line.slice(0, cursor.ch);
    const functionCallMatch = beforeCursor.match(/([\w.]+)\([^)]*$/);

    if (functionCallMatch) {
      this.closeCompletionDropdown();
      this.showSignatureHelp(editor, cursor);
      return;
    }

    this.closeSignatureHelpDropdown();
    this.showCompletion(editor, cursor);
  }

  private showSignatureHelp(editor: Editor, cursor: EditorPosition) {
    if (!this.rLanguageServer) {
      return;
    }

    const virtualDocument = this.createVirtualDocument(editor, cursor);
    if (!virtualDocument) {
      this.closeSignatureHelpDropdown();
      return;
    }

    this.rLanguageServer.sendNotification('textDocument/didOpen', {
      textDocument: virtualDocument.textDocument,
    });

    this.rLanguageServer.sendSignatureHelpRequest(
      virtualDocument.textDocument.uri,
      virtualDocument.position,
      (response) => {
        if (response.result?.signatures?.length) {
          this.handleSignatureHelp(response.result);
        } else {
          this.closeSignatureHelpDropdown();
        }
      }
    );
  }

  private showCompletion(editor: Editor, cursor: EditorPosition) {
    if (!this.rLanguageServer) {
      return;
    }

    const virtualDocument = this.createVirtualDocument(editor, cursor);
    if (!virtualDocument) {
      this.closeCompletionDropdown();
      return;
    }

    this.rLanguageServer.sendNotification('textDocument/didOpen', {
      textDocument: virtualDocument.textDocument,
    });

    this.rLanguageServer.sendRequest(
      'textDocument/completion',
      {
        textDocument: { uri: virtualDocument.textDocument.uri },
        position: virtualDocument.position,
        context: { triggerKind: 1 },
      },
      (response) => {
        const items = Array.isArray(response.result)
          ? response.result
          : response.result?.items || [];
        this.handleCompletion(items);
      }
    );
  }

  private createVirtualDocument(editor: Editor, cursor: EditorPosition) {
    const { codeWithAll, startLine } = getCurrentCodeChunk(editor, cursor.line);
    if (!codeWithAll) {
      return null;
    }

    const tempDir = os.tmpdir();
    const tempFilePath = path.join(
      tempDir,
      `obsidian-virtual-document-${this.nextDocumentId()}.r`
    );
    fs.writeFileSync(tempFilePath, codeWithAll);

    return {
      textDocument: {
        uri: `file://${tempFilePath.replace(/\\/g, '/')}`,
        languageId: 'r',
        version: 1,
        text: codeWithAll,
      },
      position: {
        line: cursor.line - (startLine + 1),
        character: cursor.ch,
      },
    };
  }

  private handleSignatureHelp(result: any) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    if (this.signatureHelpDropdown) {
      this.signatureHelpDropdown.updateContent(result.signatures);
      return;
    }

    this.signatureHelpDropdown = new SignatureHelpDropdown(
      this.app,
      activeView.editor,
      result.signatures,
      () => {
        this.signatureHelpDropdown = null;
      }
    );
  }

  private closeSignatureHelpDropdown() {
    if (!this.signatureHelpDropdown) {
      return;
    }

    this.signatureHelpDropdown.close();
    this.signatureHelpDropdown = null;
  }

  public applyWrapping(wrapper: string) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const selection = editor.getSelection();

    if (selection) {
      editor.replaceSelection(`${wrapper}${selection}${wrapper}`);
      const cursor = editor.getCursor();
      const start = {
        line: cursor.line,
        ch: cursor.ch - selection.length - wrapper.length,
      };
      const end = { line: cursor.line, ch: cursor.ch - wrapper.length };
      editor.setSelection(start, end);
    } else {
      const cursor = editor.getCursor();
      editor.replaceRange(`${wrapper}${wrapper}`, cursor);
      const newCursor = { line: cursor.line, ch: cursor.ch + wrapper.length };
      editor.setSelection(newCursor, newCursor);
    }

    editor.focus();
  }

  public applyHtmlTag(tag: string) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const selection = editor.getSelection();
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    if (selection) {
      editor.replaceSelection(`${openTag}${selection}${closeTag}`);
      const cursor = editor.getCursor();
      editor.setCursor({ line: cursor.line, ch: cursor.ch - closeTag.length });
    } else {
      editor.replaceRange(`${openTag}${closeTag}`, editor.getCursor());
      const cursor = editor.getCursor();
      editor.setCursor({ line: cursor.line, ch: cursor.ch - closeTag.length });
    }

    editor.focus();
  }

  public applyHeading(level: number) {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const cursor = editor.getCursor();
    const lineContent = editor.getLine(cursor.line);
    const headingPrefix = `${'#'.repeat(level)} `;

    if (lineContent.startsWith('#')) {
      const lineWithoutHashes = lineContent.replace(/^#+\s*/, '');
      editor.replaceRange(
        headingPrefix + lineWithoutHashes,
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: lineContent.length }
      );
    } else {
      editor.replaceRange(headingPrefix, { line: cursor.line, ch: 0 });
    }

    editor.setCursor({ line: cursor.line, ch: headingPrefix.length });
    editor.focus();
  }

  public insertCodeBlock(language: string, editorOverride?: Editor) {
    const editor =
      editorOverride || this.app.workspace.getActiveViewOfType(MarkdownView)?.editor || null;
    if (!editor) {
      return;
    }

    const cursor = editor.getCursor();
    const codeFenceStart = language === 'r' ? '```{r}\n' : `\`\`\`${language}\n`;
    const codeFenceEnd = '\n```\n';

    editor.replaceRange(codeFenceStart + codeFenceEnd, cursor);
    editor.setCursor({ line: cursor.line + 1, ch: 0 });
    editor.focus();
  }

  public applyAlignment(alignment: 'left' | 'center' | 'right' | 'justify') {
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    const editor = activeView.editor;
    const selection = editor.getSelection();
    const openDiv = `<div style="text-align: ${alignment};">`;
    const closeDiv = '</div>';

    if (selection) {
      editor.replaceSelection(`${openDiv}\n${selection}\n${closeDiv}`);
      const cursor = editor.getCursor();
      editor.setCursor({ line: cursor.line + 1, ch: 0 });
    } else {
      editor.replaceRange(`${openDiv}\n\n${closeDiv}`, editor.getCursor());
      const cursor = editor.getCursor();
      editor.setCursor({ line: cursor.line - 1, ch: openDiv.length + 1 });
    }

    editor.focus();
  }

  public runCommand(commandId: string) {
    const fullCommandId = `ridian:${commandId}`;
    (this.app as any).commands.executeCommandById(fullCommandId);
  }
}
