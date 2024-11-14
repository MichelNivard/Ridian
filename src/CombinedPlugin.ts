// src/CombinedPlugin.ts

import { App, Plugin, MarkdownView, Notice, TFile } from 'obsidian';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { FloatingMenu } from './FloatingMenu';
import { REnvironmentView, VIEW_TYPE_R_ENVIRONMENT } from './REnvironmentView';
import { RHelpView, VIEW_TYPE_R_HELP } from './RHelpView';
import { MyPluginSettingTab, CombinedPluginSettings, DEFAULT_SETTINGS } from './SettingsTab';
import { runCurrentCodeChunk,} from './RCodeEvaluator';
import { exportNoteWithQuarto } from './ExportHandler';
import { setupPathEnvironment } from './PathUtils';

export default class CombinedPlugin extends Plugin {
  settings: CombinedPluginSettings;
  floatingMenu: FloatingMenu;
  rProcesses: Map<string, ChildProcessWithoutNullStreams> = new Map();

  async onload() {
    console.log('Loading Combined Plugin');

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

    console.log('Combined Plugin loaded successfully');
  }

  onunload() {
    console.log('Unloading Combined Plugin');

    this.floatingMenu.onUnload();

    this.rProcesses.forEach((rProcess) => {
      rProcess.kill();
    });
    this.rProcesses.clear();

    this.detachViews();

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
  

  private detachViews() {
    this.app.workspace.getLeavesOfType(VIEW_TYPE_R_ENVIRONMENT).forEach((leaf) => leaf.detach());
    this.app.workspace.getLeavesOfType(VIEW_TYPE_R_HELP).forEach((leaf) => leaf.detach());
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
  public  runCommand(commandId: string) {
    const fullCommandId = `ridian:${commandId}`;
    console.log(`Executing command: ${fullCommandId}`);
    (this.app as any).commands.executeCommandById(fullCommandId);
    //(this.app as any).commands.executeCommandById(commandId);
     //this.app.commands.executeCommandById(commandId)
     
  }
}
