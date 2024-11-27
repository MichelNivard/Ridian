//src/Modal.ts
import { App, Editor, Point, TFile } from 'obsidian';
import { Completion } from '@codemirror/autocomplete';

export class CompletionDropdown {
  private app: App;
  private editor: Editor;
  private completions: Completion[];
  private containerEl: HTMLElement;
  private onSelect: (completion: Completion) => void;
  private selectedIndex: number = -1;

  constructor(app: App, editor: Editor, completions: Completion[], onSelect: (completion: Completion) => void) {
    this.app = app;
    this.editor = editor;
    this.completions = completions;
    this.onSelect = onSelect;
    this.createDropdown();
  }

  private createDropdown() {
    this.containerEl = createEl('div', { cls: 'completion-dropdown' });


    // Style the container
    this.containerEl.style.position = 'absolute';
    this.containerEl.style.zIndex = '1000';
    this.containerEl.style.backgroundColor = 'var(--background-primary)';
    this.containerEl.style.border = '1px solid var(--background-modifier-border)';
    this.containerEl.style.borderRadius = '4px';
    this.containerEl.style.maxHeight = '200px';
    this.containerEl.style.overflowY = 'auto';

    // Populate with completions
    this.completions.forEach((completion, index) => {
      const itemEl = this.containerEl.createDiv({ cls: 'completion-item' });
      itemEl.textContent = completion.label;
      itemEl.addEventListener('click', () => {
        this.onSelect(completion);
        this.close();
      });

      // Keyboard navigation
      itemEl.addEventListener('mouseenter', () => {
        this.highlightItem(index);
      });
    });

    // Position the dropdown
    this.positionDropdown();

    document.body.appendChild(this.containerEl);

    // Add event listeners
    this.addEventListeners();
  }

  private positionDropdown() {
    const cursorCoords = (this.editor as any).coordsAtPos(this.editor.getCursor());
    if (cursorCoords) {
      this.containerEl.style.left = `${cursorCoords.left}px`;
      this.containerEl.style.top = `${cursorCoords.bottom}px`;
    } else {
      // Fallback position
      this.containerEl.style.left = '100px';
      this.containerEl.style.top = '100px';
    }
  }
  private addEventListeners() {
    document.addEventListener('click', this.handleDocumentClick);
    document.addEventListener('keydown', this.handleKeyDown, true); // Use capture phase
  }
  private removeEventListeners() {
    document.removeEventListener('click', this.handleDocumentClick);
    document.removeEventListener('keydown', this.handleKeyDown, true); // Ensure capture phase
  }


  private handleDocumentClick = (evt: MouseEvent) => {
    if (!this.containerEl.contains(evt.target as Node)) {
      this.close();
    }
  };

  private handleKeyDown = (evt: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Escape', 'Enter'].includes(evt.key)) {
        evt.preventDefault();
        evt.stopPropagation(); // Prevent the event from bubbling up to the editor
    }

    switch (evt.key) {
        case 'ArrowDown':
            this.moveSelection(1);
            break;
        case 'ArrowUp':
            this.moveSelection(-1);
            break;
        case 'Escape':
            this.close();
            break;
        case 'Enter':
            if (this.selectedIndex >= 0 && this.selectedIndex < this.completions.length) {
                const selectedCompletion = this.completions[this.selectedIndex];
                this.onSelect(selectedCompletion);
                this.close();
                this.editor.focus(); // Restore focus to the editor
            }
            break;
    }
};

  
  
  private moveSelection(direction: number) {
    const items = this.containerEl.querySelectorAll('.completion-item');
    if (items.length === 0) return;

    // Remove existing highlight
    if (this.selectedIndex >= 0 && this.selectedIndex < items.length) {
      items[this.selectedIndex].removeClass('is-selected');
    }

    // Update index
    this.selectedIndex += direction;
    if (this.selectedIndex < 0) this.selectedIndex = items.length - 1;
    if (this.selectedIndex >= items.length) this.selectedIndex = 0;

    // Add new highlight
    items[this.selectedIndex].addClass('is-selected');
    items[this.selectedIndex].scrollIntoView({ block: 'nearest' });
  }

  private highlightItem(index: number) {
    const items = this.containerEl.querySelectorAll('.completion-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.addClass('is-selected');
        this.selectedIndex = index;
      } else {
        item.removeClass('is-selected');
      }
    });
  }

  public close() {
    this.removeEventListeners();
    if (this.containerEl && this.containerEl.parentElement) {
        this.containerEl.parentElement.removeChild(this.containerEl);
    }
    this.editor.focus(); // Restore focus to the editor
    }
}
