// src/SignatureHelpDropdown.ts

import { App, Editor } from 'obsidian';

interface MarkupContent {
    kind: 'plaintext' | 'markdown';
    value: string;
}

interface Signature {
    label: string;
    documentation?: string | MarkupContent;
}

export class SignatureHelpDropdown {
    private app: App;
    private editor: Editor;
    private signatures: Signature[];
    private containerEl: HTMLElement;
    private onClose: () => void;
    private selectedIndex: number = -1;

    constructor(app: App, editor: Editor, signatures: Signature[], onClose: () => void) {
        this.app = app;
        this.editor = editor;
        this.signatures = signatures;
        this.onClose = onClose;
        this.createDropdown();
    }

    private createDropdown() {
        this.containerEl = createEl('div', { cls: 'signature-help-dropdown' });


        // Populate with signatures
        this.signatures.forEach((signature, index) => {
            const labelEl = this.containerEl.createDiv({ cls: 'signature-label' });
            labelEl.textContent = signature.label;


            const valueEl = this.containerEl.createDiv({ cls: 'signature-value' });
            valueEl.textContent = this.extractDocumentation(signature.documentation);

        });

        // Position the dropdown
        this.positionDropdown();

        document.body.appendChild(this.containerEl);

        // Add event listeners
        this.addEventListeners();
    }

    private extractDocumentation(documentation?: string | MarkupContent): string {
        if (!documentation) return '';
        if (typeof documentation === 'string') return documentation;
        if ('value' in documentation) return documentation.value;
        return '';
    }

    private positionDropdown() {
        const cursorPos = (this.editor as any).coordsAtPos(this.editor.getCursor());
        if (cursorPos) {
            this.containerEl.style.left = `${cursorPos.left}px`;
            this.containerEl.style.top = `${cursorPos.bottom + 5}px`; // 5px below the cursor
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
        if (['Escape'].includes(evt.key)) {
            evt.preventDefault();
            this.close();
        }
    };

    public updateContent(signatures: Signature[]) {
        this.signatures = signatures;
        this.containerEl.empty();

        this.signatures.forEach((signature, index) => {
            const labelEl = this.containerEl.createDiv({ cls: 'signature-label' });
            labelEl.textContent = signature.label;


            const valueEl = this.containerEl.createDiv({ cls: 'signature-value' });
            valueEl.textContent = this.extractDocumentation(signature.documentation);

        });

        this.positionDropdown();
    }

    public close() {
        this.removeEventListeners();
        if (this.containerEl && this.containerEl.parentElement) {
            this.containerEl.parentElement.removeChild(this.containerEl);
        }
        this.onClose();
    }
}
