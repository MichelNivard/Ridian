// src/FloatingMenu.ts

import { Plugin, MarkdownView, setIcon,setTooltip } from 'obsidian';
import CombinedPlugin from './CombinedPlugin';

export class FloatingMenu {
  plugin: CombinedPlugin;
  menuContainer: HTMLDivElement;

  constructor(plugin: CombinedPlugin) {
    this.plugin = plugin;
  }

  onLoad() {
    this.addMenu();
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        this.addMenu();
      })
    );
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('layout-change', () => {
        this.addMenu();
      })
    );
  }

  onUnload() {
    if (this.menuContainer) {
      this.menuContainer.remove();
    }
  }

  private addMenu() {
    if (this.menuContainer) {
      this.menuContainer.remove();
    }

    const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) return;

    const editorContainer = activeView.containerEl.querySelector('.cm-editor');
    if (!editorContainer) return;

    this.menuContainer = document.createElement('div');
    this.menuContainer.className = 'floating-menu';

    const boldButton = this.createIconButton('bold', () => this.plugin.applyWrapping('**'), 'Bold');
    const italicButton = this.createIconButton('italic', () => this.plugin.applyWrapping('_'), 'Italic');
    const strikethroughButton = this.createIconButton('strikethrough', () => this.plugin.applyWrapping('~~'), 'Strikethrough');
    const underlineButton = this.createIconButton('underline', () => this.plugin.applyHtmlTag('u'), 'Underline');

    const alignLeftButton = this.createTextButton('align-left', '', () => this.plugin.applyAlignment('left'), 'Left align');
    const alignCenterButton = this.createTextButton('align-center', '', () => this.plugin.applyAlignment('center'), 'Center align');
    const alignRightButton = this.createTextButton('align-right', '', () => this.plugin.applyAlignment('right'), 'Right align');
    const alignJustifyButton = this.createTextButton('align-justify', '', () => this.plugin.applyAlignment('justify'), 'Justify');

    const h1Button = this.createIconButton('heading-1', () => this.plugin.applyHeading(1), 'Heading 1');
    const h2Button = this.createIconButton('heading-2', () => this.plugin.applyHeading(2), 'Heading 2');
    const h3Button = this.createIconButton('heading-3', () => this.plugin.applyHeading(3), 'Heading 3');

    const codeBlockButton = this.createTextButton('code', 'Insert R', () => this.plugin.insertCodeBlock('r'), 'R code chunk');

    const runChunkButton = this.createTextButton(
      'play',
      'Run chunk',
      () => this.plugin.runCommand('run-current-code-chunk'),
      'Run current code chunk'
    );

    const exportNoteButton = this.createTextButton(
      'file-down',
      'Render/Quarto',
      () => this.plugin.runCommand('export-note-with-quarto'),
      'Export note with Quarto'
    );

    // Apply styles if needed
    runChunkButton.classList.add('glow-on-hover');
    exportNoteButton.classList.add('glow-on-hover');
    codeBlockButton.classList.add('glow-on-hover');

    // Append buttons to the menu container
    this.menuContainer.appendChild(boldButton);
    this.menuContainer.appendChild(italicButton);
    this.menuContainer.appendChild(strikethroughButton);
    this.menuContainer.appendChild(underlineButton);
    this.menuContainer.appendChild(alignLeftButton);
    this.menuContainer.appendChild(alignCenterButton);
    this.menuContainer.appendChild(alignRightButton);
    this.menuContainer.appendChild(alignJustifyButton);
    this.menuContainer.appendChild(h1Button);
    this.menuContainer.appendChild(h2Button);
    this.menuContainer.appendChild(h3Button);
    this.menuContainer.appendChild(codeBlockButton);
    this.menuContainer.appendChild(runChunkButton);
    this.menuContainer.appendChild(exportNoteButton);

    if (editorContainer.parentElement) {
      editorContainer.parentElement.insertBefore(this.menuContainer, editorContainer);
    }

    (editorContainer as HTMLElement).style.marginTop = `${this.menuContainer.offsetHeight}px`;
  }

  private createIconButton(iconId: string, onClick: () => void, tooltip?: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'floating-menu-button';
    setIcon(button, iconId);
    if (tooltip) {
      setTooltip(button, tooltip);
      button.setAttribute('title', tooltip);
    }
    button.addEventListener('click', onClick);
    return button;
  }

  private createTextButton(iconId: string, text: string, onClick: () => void, tooltip?: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'floating-menu-button floating-menu-button-text';

    const iconSpan = document.createElement('span');
    setIcon(iconSpan, iconId);
    iconSpan.className = 'button-icon';

    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    textSpan.className = 'button-text';

    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    if (tooltip) {
      setTooltip(button, tooltip);
      button.setAttribute('title', tooltip);
    }

    button.addEventListener('click', onClick);
    return button;
  }
}
