// src/CombinedPlugin.ts

import {
  App,
  Plugin,
  MarkdownView,
  Notice,
  Editor,
  EditorPosition,
} from 'obsidian';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FloatingMenu } from './FloatingMenu';
import { REnvironmentView, VIEW_TYPE_R_ENVIRONMENT } from './REnvironmentView';
import { RHelpView, VIEW_TYPE_R_HELP } from './RHelpView';
import {
  MyPluginSettingTab,
  CombinedPluginSettings,
  DEFAULT_SETTINGS,
} from './SettingsTab';
import { runCurrentCodeChunk, getCurrentCodeChunk } from './RCodeEvaluator';
import { exportNoteWithQuarto } from './ExportHandler';
import { setupPathEnvironment } from './PathUtils';
import { RLanguageServer } from './RLanguageServer';
import { SignatureHelpDropdown } from './SignatureHelpDropdown';
import { CompletionDropdown } from './modal';
import { EditorView, ViewUpdate } from '@codemirror/view';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import {
  autocompletion,
  Completion,
  CompletionSource,
  startCompletion,
  CompletionContext,
} from '@codemirror/autocomplete';





export default class CombinedPlugin extends Plugin {
  settings: CombinedPluginSettings;
  floatingMenu: FloatingMenu;
  rProcesses: Map<string, ChildProcessWithoutNullStreams> = new Map();
  private rLanguageServer: RLanguageServer;
  private _documentId = 1;
  private isInsertingCompletion: boolean = false;
  private currentCompletions: Completion[] = [];
  private currentDropdown: CompletionDropdown | null = null;
  private signatureHelpDropdown: SignatureHelpDropdown | null = null;

  private completionSource: CompletionSource = (context: CompletionContext) => {
    console.log('completionSource called, context:', context);
  
    if (this.currentCompletions.length === 0) {
      return null;
    }
  
    const word = context.matchBefore(/\w*/);
    if (!word || (word.from === word.to && context.explicit === false)) {
      return null;
    }
  
    return {
      from: word.from,
      to: context.pos,
      options: this.currentCompletions,
    };
  };
  

  async onload() {
    console.log('Loading Combined Plugin');
    // Apply wider code chunks
    document.body.setAttribute('ridian', 'true');

    await this.loadSettings();
    setupPathEnvironment();

    this.floatingMenu = new FloatingMenu(this);
    if (this.settings.enableFloatingMenu) {
      this.floatingMenu.onLoad();
    }

    this.addSettingTab(new MyPluginSettingTab(this.app, this));

    this.registerView(VIEW_TYPE_R_ENVIRONMENT, (leaf) => new REnvironmentView(leaf));
    this.registerView(VIEW_TYPE_R_HELP, (leaf) => new RHelpView(leaf));

    this.app.workspace.onLayoutReady(() => {
      this.initializeViews();
    });

    this.registerCommands();

    const rExecutablePath = this.settings.rExecutablePath.trim() || '/usr/local/bin/R';

    this.rLanguageServer = new RLanguageServer(
      rExecutablePath,
      this.handleCompletion.bind(this),
      this.handleHover.bind(this)
    );
    this.rLanguageServer.start();

    // Register editor events
    this.registerEditorEvents();

    console.log('Combined Plugin loaded successfully');
  }

  onunload() {
    console.log('Unloading Combined Plugin');
    // Remove wider code chunks
    document.body.removeAttribute('ridian');

    this.floatingMenu.onUnload();

    this.rLanguageServer.stop();

    console.log('Combined Plugin unloaded successfully');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private initializeViews() {
    // Initialize R Environment View
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_R_ENVIRONMENT).length === 0) {
      const leaf = this.app.workspace.getRightLeaf(false);
      if (leaf) {
        leaf.setViewState({
          type: VIEW_TYPE_R_ENVIRONMENT,
          active: true,
        });
      }
    }

    // Initialize R Help View
    if (this.app.workspace.getLeavesOfType(VIEW_TYPE_R_HELP).length === 0) {
      const leaf = this.app.workspace.getRightLeaf(true);
      if (leaf) {
        leaf.setViewState({
            type: VIEW_TYPE_R_HELP,
            active: true,
        });
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
        const noteTitle = view.file.basename;
        runCurrentCodeChunk(this, editor, view, noteTitle);
      },
      hotkeys: [{ modifiers: ['Mod'], key: 'r' }],
    });

    this.addCommand({
      id: 'export-note-with-quarto',
      name: 'Export Note with Quarto',
      callback: () => exportNoteWithQuarto(this),
    });
  }

  // Register editor events for cursor activity
  private registerEditorEvents() {
    // Handle cursor activity
    this.registerEditorExtension(
      EditorView.updateListener.of((update: ViewUpdate) => {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!activeView || !activeView.editor) {
          return;
        }

        const editor = activeView.editor;

        if (update.selectionSet) {
          this.handleCursorActivity(editor);
        }
      })
    );
  }



  private nextDocumentId(): number {
    return this._documentId++;
  }

  
  private handleCompletion(items: any[]) {
    
  
    if (items.length === 0) {
      if (this.currentDropdown) {
        console.log('No completions available. Closing existing dropdown.');
        this.currentDropdown.close();
        this.currentDropdown = null;
      }
      return;
    }

    const completions: Completion[] = items.map((item: any) => {
      const label = item.label || '';
      const insertText = item.textEdit?.newText || item.insertText || label;
      const detail = item.detail || '';
      const info =
        typeof item.documentation === 'string'
          ? item.documentation
          : item.documentation?.value || undefined;
  
      return {
        label,
        insertText,
        detail,
        info,
      };
    });
  
    this.currentCompletions = completions;
  
    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;
  
    const editor = activeView.editor;
  
    // Show the completion dropdown
    this.showCompletionDropdown(editor);
  }

  
  private handleHover(contents: string) {
    // Update the editor with hover information (tooltips)
    console.log('Hover contents:', contents);
    // Implement logic to display hover information in the editor
  }

 private showCompletionDropdown(editor: Editor) {
  if (!this.currentCompletions || this.currentCompletions.length === 0) {
    return;
  }

  // Close any existing dropdown
  if (this.currentDropdown) {
    this.currentDropdown.close();
  }

  // Create a new dropdown and store the reference
  this.currentDropdown = new CompletionDropdown(this.app, editor, this.currentCompletions, (completion) => {
    const textToInsert = (completion as any).insertText || completion.label;
    this.insertCompletionAtCursor(editor, textToInsert);
    // After inserting, close the dropdown
    if (this.currentDropdown) {
      this.currentDropdown.close();
      this.currentDropdown = null;
    }
  });
}

private insertCompletionAtCursor(editor: Editor, text: string) {
  this.isInsertingCompletion = true; // Start insertion

  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  
  // Updated regex to include dots for R function names
  const wordStart = line.slice(0, cursor.ch).match(/[\w.]*$/)?.[0] || '';
  const wordEnd = line.slice(cursor.ch).match(/^[\w.]*/)?.[0] || '';
  
  const from = { line: cursor.line, ch: cursor.ch - wordStart.length };
  const to = { line: cursor.line, ch: cursor.ch + wordEnd.length };
  
  editor.replaceRange(text, from, to);
  editor.setCursor({ line: cursor.line, ch: from.ch + text.length });

  this.isInsertingCompletion = false; // End insertion
}

/// this.currentDropdown.close();

// src/CombinedPlugin.ts
private handleCursorActivity(editor: Editor) {
  if (this.isInsertingCompletion) {
      return; // Skip handling cursor activity during insertion
  }

  const cursor = editor.getCursor();
  const line = editor.getLine(cursor.line);
  const beforeCursor = line.slice(0, cursor.ch);

  // Regex to check if the cursor is inside a function call (e.g., lm(|))
  const functionCallMatch = beforeCursor.match(/(\w+)\([^)]*$/);

  if (functionCallMatch) {
      // Cursor is inside a function call

      // Close the Completion Dropdown if it's open
      if (this.currentDropdown) {
-
          this.currentDropdown.close();
          this.currentDropdown = null;
      }

      // Proceed to show Signature Help Dropdown
      this.showSignatureHelp(editor, cursor);
  } else {
      // Cursor is outside a function call

      // Close the Signature Help Dropdown if it's open
      if (this.signatureHelpDropdown) {
 -
          this.signatureHelpDropdown.close();
          this.signatureHelpDropdown = null;
      }

      // Proceed to show Completion Dropdown
      this.showCompletion(editor, cursor);
  }
}

private showSignatureHelp(editor: Editor, cursor: EditorPosition) {
  const { codeWithAll, startLine } = getCurrentCodeChunk(editor, cursor.line);

  if (!codeWithAll) {
      this.closeSignatureHelpDropdown();
      return;
  }

  // Write code chunk to a temporary file
  const tempDir = os.tmpdir();
  const tempFileName = `obsidian-virtual-document-${this.nextDocumentId()}.r`;
  const tempFilePath = path.join(tempDir, tempFileName);
  fs.writeFileSync(tempFilePath, codeWithAll);

  const virtualUri = `file://${tempFilePath.replace(/\\/g, '/')}`; // Replace backslashes on Windows
  const languageId = 'r';
  const version = 1;

  // Adjust the cursor position relative to the code chunk
  const position = {
      line: cursor.line - (startLine + 1), // Adjusted line number
      character: cursor.ch,
  };

  // Log the uri and position

  // Send didOpen notification for the code chunk
  this.rLanguageServer.sendNotification('textDocument/didOpen', {
      textDocument: {
          uri: virtualUri,
          languageId: languageId,
          version: version,
          text: codeWithAll,
      },
  });

  // Send signature help request with a response handler
  this.rLanguageServer.sendSignatureHelpRequest(
      virtualUri,
      position,
      (response) => {
          if (response.result) {
              this.handleSignatureHelp(response.result);
          } else {
              console.error('Unexpected signatureHelp response:', response);
              this.closeSignatureHelpDropdown();
          }
      }
  );
}

private showCompletion(editor: Editor, cursor: EditorPosition) {
  const { codeWithAll, startLine } = getCurrentCodeChunk(editor, cursor.line);

  if (!codeWithAll) {

      if (this.currentDropdown) {

        this.currentDropdown.close();
        this.currentDropdown = null;
      }
      return;
  }

  // Write code chunk to a temporary file
  const tempDir = os.tmpdir();
  const tempFileName = `obsidian-virtual-document-${this.nextDocumentId()}.r`;
  const tempFilePath = path.join(tempDir, tempFileName);
  fs.writeFileSync(tempFilePath, codeWithAll);

  const virtualUri = `file://${tempFilePath.replace(/\\/g, '/')}`; // Replace backslashes on Windows
  const languageId = 'r';
  const version = 1;

  // Adjust the cursor position relative to the code chunk
  const position = {
      line: cursor.line - (startLine + 1), // Adjusted line number
      character: cursor.ch,
  };



  // Send didOpen notification for the code chunk
  this.rLanguageServer.sendNotification('textDocument/didOpen', {
      textDocument: {
          uri: virtualUri,
          languageId: languageId,
          version: version,
          text: codeWithAll,
      },
  });

  // Send completion request with a response handler
  this.rLanguageServer.sendRequest(
      'textDocument/completion',
      {
          textDocument: { uri: virtualUri },
          position: position,
          context: { triggerKind: 1 },
      },
      (response) => {
          if (response.result && response.result.items) {
              this.handleCompletion(response.result.items);
          } else {
              console.error('Unexpected completion response:', response);
          }
      }
  );
}


private handleSignatureHelp(result: any) {
  if (!result || !result.signatures || result.signatures.length === 0) {
    this.closeSignatureHelpDropdown();
    return;
  }

  const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
  if (!activeView) return;

  const editor = activeView.editor;

  if (this.signatureHelpDropdown) {
    this.signatureHelpDropdown.updateContent(result.signatures);
  } else {
    this.signatureHelpDropdown = new SignatureHelpDropdown(this.app, editor, result.signatures, () => {
      this.signatureHelpDropdown = null;
    });
  }
}

private closeSignatureHelpDropdown() {
  if (this.signatureHelpDropdown) {
    this.signatureHelpDropdown.close();
    this.signatureHelpDropdown = null;
  }
}



  // Utility methods for text formatting in the editor

  public applyWrapping(wrapper: string) {
    const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeLeaf) return;

    const editor = activeLeaf.editor;
    const selection = editor.getSelection();

    if (selection) {
      editor.replaceSelection(`${wrapper}${selection}${wrapper}`);
      const cursor = editor.getCursor();
      const start = { line: cursor.line, ch: cursor.ch - selection.length - wrapper.length };
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
    const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeLeaf) return;

    const editor = activeLeaf.editor;
    const selection = editor.getSelection();
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    if (selection) {
      editor.replaceSelection(`${openTag}${selection}${closeTag}`);
      const cursor = editor.getCursor();
      const newCh = cursor.ch - closeTag.length;
      editor.setCursor({ line: cursor.line, ch: newCh });
    } else {
      editor.replaceRange(`${openTag}${closeTag}`, editor.getCursor());
      const cursor = editor.getCursor();
      editor.setCursor({ line: cursor.line, ch: cursor.ch - closeTag.length });
    }

    editor.focus();
  }

  public applyHeading(level: number) {
    const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeLeaf) return;

    const editor = activeLeaf.editor;
    const cursor = editor.getCursor();
    const lineContent = editor.getLine(cursor.line);

    const headingPrefix = '#'.repeat(level) + ' ';
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

    const newCh = headingPrefix.length;
    editor.setCursor({ line: cursor.line, ch: newCh });

    editor.focus();
  }

  public insertCodeBlock(language: string) {
    const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeLeaf) return;

    const editor = activeLeaf.editor;
    const cursor = editor.getCursor();

    const codeBlock = `\`\`\`${language}\n`;
    const codeBlockEnd = `\n\`\`\`\n`;

    editor.replaceRange(codeBlock, cursor);
    editor.replaceRange(codeBlockEnd, { line: cursor.line, ch: cursor.ch + codeBlock.length });

    const newCursor = { line: cursor.line + 1, ch: 0 };
    editor.setSelection(newCursor, newCursor);

    editor.focus();
  }

  public applyAlignment(alignment: 'left' | 'center' | 'right' | 'justify') {
    const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeLeaf) return;

    const editor = activeLeaf.editor;
    const selection = editor.getSelection();
    const openDiv = `<div style="text-align: ${alignment};">`;
    const closeDiv = `</div>`;

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

  // Method to run commands from the floating menu
  public runCommand(commandId: string) {
    const fullCommandId = `ridian:${commandId}`;
    (this.app as any).commands.executeCommandById(fullCommandId);
  }
}
