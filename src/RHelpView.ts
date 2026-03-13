// src/RHelpView.ts

import { ItemView, WorkspaceLeaf } from 'obsidian';
import CombinedPlugin from './CombinedPlugin';

export const VIEW_TYPE_R_HELP = 'r-help-view';

export class RHelpView extends ItemView {
  private plugin: CombinedPlugin;
  private helpContent: string = '';

  constructor(leaf: WorkspaceLeaf, plugin: CombinedPlugin) {
    super(leaf);
    this.plugin = plugin;
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
    const snapshot = this.plugin.getLatestHelpSnapshot();
    if (snapshot) {
      this.helpContent = snapshot.helpContent;
    }
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

    if (!this.helpContent) {
      content.textContent = 'Run ?topic or help(topic) in an R chunk to load help here.';
      this.contentEl.appendChild(content);
      return;
    }

    content.innerHTML = this.helpContent;

    const codeElements = content.querySelectorAll('code');
    codeElements.forEach((codeElement) => {
      codeElement.classList.add('r-help-code');
    });

    this.contentEl.appendChild(content);
  }
}
