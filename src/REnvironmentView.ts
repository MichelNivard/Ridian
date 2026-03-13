// src/REnvironmentView.ts

import { ItemView, WorkspaceLeaf } from 'obsidian';
import CombinedPlugin from './CombinedPlugin';
import { EnvironmentVariable } from './RCodeEvaluator';

export const VIEW_TYPE_R_ENVIRONMENT = 'r-environment-view';

export class REnvironmentView extends ItemView {
  private plugin: CombinedPlugin;
  private environmentData: EnvironmentVariable[] = [];
  private noteTitle: string = '';

  constructor(leaf: WorkspaceLeaf, plugin: CombinedPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType() {
    return VIEW_TYPE_R_ENVIRONMENT;
  }

  getDisplayText() {
    return 'R Environment';
  }

  getIcon() {
    return 'table';
  }

  async onOpen() {
    this.containerEl.empty();
    const snapshot = this.plugin.getLatestEnvironmentSnapshot();
    if (snapshot) {
      this.noteTitle = snapshot.noteTitle;
      this.environmentData = snapshot.variables;
    }
    this.render();
  }

  async onClose() {
    // Cleanup if needed
  }

  public updateEnvironmentData(noteTitle: string, data: EnvironmentVariable[]) {
    this.noteTitle = noteTitle;
    this.environmentData = data;
    this.render();
  }

  private render() {
    this.containerEl.empty();

    const content = document.createElement('div');
    content.classList.add('r-environment-content');

    const title = document.createElement('h5');
    title.textContent = this.noteTitle
      ? `R environment for ${this.noteTitle}`
      : 'R environment';
    title.classList.add('r-environment-title');

    content.appendChild(title);

    if (this.environmentData.length === 0) {
      const emptyState = document.createElement('p');
      emptyState.textContent = 'Run an R chunk to populate this note-local environment.';
      content.appendChild(emptyState);
      this.containerEl.appendChild(content);
      return;
    }

    const table = document.createElement('table');
    table.classList.add('r-environment-table');

    const headerRow = document.createElement('tr');
    const headers = ['Name', 'Type', 'Size', 'Value'];
    headers.forEach((headerText) => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.classList.add('r-environment-header-cell');
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    this.environmentData.forEach((variable) => {
      const row = document.createElement('tr');
      row.classList.add('r-environment-row');

      const createCell = (text: string, textAlign: string = 'left') => {
        const cell = document.createElement('td');
        cell.textContent = text;
        cell.classList.add('r-environment-cell');
        if (textAlign === 'right') {
          cell.classList.add('text-align-right');
        }
        return cell;
      };

      const nameCell = createCell(variable.name);
      row.appendChild(nameCell);

      const typeCell = createCell(Array.isArray(variable.type) ? variable.type.join(', ') : variable.type);
      row.appendChild(typeCell);

      function formatSize(bytes: number) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes == 0) return '0 Byte';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
      }

      const sizeCell = createCell(formatSize(variable.size), 'right');
      row.appendChild(sizeCell);

      const valuePreview = Array.isArray(variable.value)
        ? `${variable.value.slice(0, 5).join(', ')} ...`
        : String(variable.value);
      const valCell = createCell(valuePreview);
      valCell.classList.add('value-cell');
      row.appendChild(valCell);

      table.appendChild(row);
    });

    content.appendChild(table);
    this.containerEl.appendChild(content);
  }
}
