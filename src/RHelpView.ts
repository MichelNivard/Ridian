// src/RHelpView.ts

import { ItemView, WorkspaceLeaf } from 'obsidian';

export const VIEW_TYPE_R_HELP = 'r-help-view';

export class RHelpView extends ItemView {
  private helpContent: string = '';

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_R_HELP;
  }

  getDisplayText() {
    return 'R Help';
  }

  getIcon() {
    return 'info';
  }

  async onOpen() {
    this.contentEl.empty();
    this.render();
  }

  async onClose() {
    // Cleanup if needed
  }

  public updateHelpContent(helpContent: string) {
    this.helpContent = helpContent;
    this.render();
  }

  private render() {
    this.contentEl.empty();

    const content = document.createElement('div');
    content.classList.add('r-help-content');

    content.innerHTML = this.helpContent;

    const codeElements = content.querySelectorAll('code');
    codeElements.forEach((codeElement) => {
      codeElement.classList.add('r-help-code');
    });

    this.contentEl.appendChild(content);
  }
}
