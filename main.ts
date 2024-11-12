import {
  App,
  Editor,
  Plugin,
  MarkdownView,
  setIcon,
  Notice,
  TFile,
  ItemView,
  WorkspaceLeaf,
  PluginSettingTab,
  Setting,
  FileSystemAdapter,
  
} from 'obsidian';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import * as os from 'os';
import { createHash } from 'crypto';
import { pathToFileURL } from 'url';




// Promisify fs functions
const mkdtempAsync = promisify(fs.mkdtemp);

// Define constants for the R Code Evaluator
const VIEW_TYPE_R_ENVIRONMENT = 'r-environment-view';
const VIEW_TYPE_R_HELP = 'r-help-view';




// Define the settings interface
interface CombinedPluginSettings {
  rExecutablePath: string;
  rstudioPandocPath: string;
  quartoExecutablePath: string;
  enableFloatingMenu: boolean; // **Add this line**
  // Add any additional settings from FloatingMenuPlugin if needed
}

// Define default settings
const DEFAULT_SETTINGS: CombinedPluginSettings = {
  rExecutablePath: '/usr/local/bin/R',
  rstudioPandocPath: '/opt/homebrew/bin/',
  quartoExecutablePath: '/usr/local/bin/quarto',
  enableFloatingMenu: true, // **Add this line with a default value**
  // Initialize additional settings if needed
};

// FloatingMenuPlugin functionality
class FloatingMenu {
  plugin: CombinedPlugin;
  menuContainer: HTMLDivElement;

  constructor(plugin: CombinedPlugin) {
    this.plugin = plugin;
  }
 // onload for the menu.
  onLoad() {
    console.log('Loading Floating Menu Plugin');
    this.addMenu();
    // Register events to update the menu when the active leaf or layout changes
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('active-leaf-change', () => {
        console.log('Active leaf changed. Updating menu.');
        this.addMenu();
      })
    );
  
    this.plugin.registerEvent(
      this.plugin.app.workspace.on('layout-change', () => {
        console.log('Layout changed. Updating menu.');
        this.addMenu();
      })
          
    
    );

    

  }

  onUnload() {
    console.log('Unloading Floating Menu Plugin');

    // Remove the menu container when the plugin is unloaded
    if (this.menuContainer) {
      this.menuContainer.remove();
    }
  }

  

  addMenu() {
    // Remove existing menu if it exists to prevent duplicates
    if (this.menuContainer) {
      this.menuContainer.remove();
    }


    // Get the active markdown view
    const activeView = this.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeView) {
      return;
    }

    // Get the editor's container element
    const editorContainer = activeView.containerEl.querySelector('.cm-editor');
    if (!editorContainer) {
      console.log('Editor container not found.');
      return;
    }

    // Create the menu container
    this.menuContainer = document.createElement('div');
    this.menuContainer.className = 'floating-menu';

    // Create buttons with icons
    const boldButton = this.createIconButton('bold', () => this.plugin.applyWrapping('**'), 'Bold');
    const italicButton = this.createIconButton('italic', () => this.plugin.applyWrapping('_'), 'Italic');
    const strikethroughButton = this.createIconButton('strikethrough', () => this.plugin.applyWrapping('~~'), 'Strikethrough');
    const underlineButton = this.createIconButton('underline', () => this.plugin.applyHtmlTag('u'), 'Underline');

    // Create alignment buttons
    const alignLeftButton = this.createTextButton('align-left', '', () => this.plugin.applyAlignment('left'), 'Left Align');
    const alignCenterButton = this.createTextButton('align-center', '', () => this.plugin.applyAlignment('center'), 'Center Align');
    const alignRightButton = this.createTextButton('align-right', '', () => this.plugin.applyAlignment('right'), 'Right Align');
    const alignJustifyButton = this.createTextButton('align-justify', '', () => this.plugin.applyAlignment('justify'), 'Justify');

    const h1Button = this.createIconButton('heading-1', () => this.plugin.applyHeading(1), 'Heading 1');
    const h2Button = this.createIconButton('heading-2', () => this.plugin.applyHeading(2), 'Heading 2');
    const h3Button = this.createIconButton('heading-3', () => this.plugin.applyHeading(3), 'Heading 3');

    // Create the R code chunk button with icon and text
    const codeBlockButton = this.createTextButton('code', 'Insert R', () => this.plugin.insertCodeBlock('r'), 'R code chunk');

    // Create buttons for the external plugin commands using logo & text buttons
    // Create buttons for the external plugin commands using logo & text buttons
    const runChunkButton = this.createTextButton(
      'play',
      'Run Chunk',
      () => this.plugin.runCommand('ridian:run-current-code-chunk'), // Corrected ID
      'Run Current Code Chunk'
    );

    const exportNoteButton = this.createTextButton(
      'file-down',
      'Render/Quarto',
      () => this.plugin.runCommand('ridian:export-note-with-quarto'), // Corrected ID
      'Export Note with Quarto'
    );

    // Apply the glow-on-hover class to the last three buttons
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

    // Insert the menu into the editor container's parent
    if (editorContainer.parentElement) {
      editorContainer.parentElement.insertBefore(this.menuContainer, editorContainer);
    } else {
      console.log('Parent element of editorContainer is null.');
      return;
    }

    // Adjust the editor container to account for the menu height
    (editorContainer as HTMLElement).style.marginTop = `${this.menuContainer.offsetHeight}px`;
  }



  /**
   * Creates a button with only an icon.
   */
  createIconButton(iconId: string, onClick: () => void, tooltip?: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'floating-menu-button';
    setIcon(button, iconId);
    if (tooltip) {
      button.setAttribute('aria-label', tooltip);
      button.setAttribute('title', tooltip);
    }
    button.addEventListener('click', onClick);
    return button;
  }

  /**
   * Creates a button with both an icon and text.
   */
  createTextButton(iconId: string, text: string, onClick: () => void, tooltip?: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.className = 'floating-menu-button floating-menu-button-text';

    // Create the icon span
    const iconSpan = document.createElement('span');
    setIcon(iconSpan, iconId);
    iconSpan.className = 'button-icon';

    // Create the text span
    const textSpan = document.createElement('span');
    textSpan.textContent = text;
    textSpan.className = 'button-text';

    // Append icon and text to the button
    button.appendChild(iconSpan);
    button.appendChild(textSpan);

    if (tooltip) {
      button.setAttribute('aria-label', tooltip);
      button.setAttribute('title', tooltip);
    }

    button.addEventListener('click', onClick);
    return button;
  }


}

// Create the REnvironmentView class
class REnvironmentView extends ItemView {
  private environmentData: any[] = [];
  private noteTitle: string = ''; // Property to store the note title

  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
  }

  getViewType() {
    return VIEW_TYPE_R_ENVIRONMENT;
  }

  getDisplayText() {
    return 'R Environment';
  }

  getIcon() {
    return 'table'; // Changed to a valid Obsidian icon
  }

  async onOpen() {
    console.log('REnvironmentView opened');
    this.containerEl.empty();
    this.render();
  }

  async onClose() {
    console.log('REnvironmentView closed');
    // Cleanup if needed
  }

  public updateEnvironmentData(noteTitle: string, data: any[]) {
    console.log(`Updating environment data for note: ${noteTitle}`, data);
    this.noteTitle = noteTitle;
    this.environmentData = data;
    this.render();
  }

  private render() {
    console.log('REnvironmentView render called with data:', this.environmentData);
    this.containerEl.empty();

    const content = document.createElement('div');
    content.style.padding = '10px';
    content.style.overflowY = 'auto';

    // Create and append the title
    const title = document.createElement('h5');
    title.textContent = `R environment for ${this.noteTitle}`; // Dynamic title
    title.style.fontFamily = '"Helvetica Neue", sans-serif'; // Heavy, stylish font
    title.style.fontSize = '18px';
    title.style.fontWeight = '250';
    title.style.marginBottom = '15px';
    title.style.padding = '10px';
    title.style.borderRadius = '8px';
    title.style.textAlign = 'center';
    title.classList.add('theme-aware-title');

    content.appendChild(title);

    // Create a table
    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'separate';
    table.style.borderSpacing = '0';
    table.style.fontFamily = `'Monaco', 'monospace'`;
    table.style.whiteSpace = 'nowrap';
    table.style.overflow = 'hidden';
    table.style.borderRadius = '12px';
    table.style.tableLayout = 'fixed';
    table.style.border = '1px solid rgba(200, 200, 200, 0.3)'; // Subtle vertical border for the table
    table.classList.add('theme-aware-table');

    // Create table header
    const headerRow = document.createElement('tr');
    const headers = ['Name', 'Type', 'Size', 'Value'];
    headers.forEach((headerText, index) => {
      const th = document.createElement('th');
      th.textContent = headerText;
      th.style.padding = '12px';
      th.style.textAlign = 'left';
      th.style.fontFamily = '"Helvetica Neue", sans-serif'; // Heavy, stylish font
      th.style.fontSize = '12px';
      th.style.fontWeight = '250';
      th.style.borderBottom = '2px solid rgba(200, 200, 200, 0.5)';
      th.style.borderRight = '1px solid rgba(200, 200, 200, 0.3)'; // Subtle vertical border
      if (headerText === 'Type') {
        th.style.width = '90px';
      }
      if (headerText === 'Size') {
        th.style.width = '80px';
      }
      if (headerText === 'Name') {
        th.style.width = '60px';
      }
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Display the environment data
    const variables = this.environmentData;
    variables.forEach((variable: any) => {
      const row = document.createElement('tr');

      // Optional: Add hover effect to rows
      row.style.transition = 'background-color 0.3s';
      row.style.borderRadius = '12px';
      row.classList.add('theme-aware-row');
      row.addEventListener('mouseover', () => {
        row.style.backgroundColor = 'var(--hover-background-color)';
      });
      row.addEventListener('mouseout', () => {
        row.style.backgroundColor = 'var(--row-background-color)';
      });

      // Helper function to create cells
      const createCell = (text: string, textAlign: string = 'left') => {
        const cell = document.createElement('td');
        cell.textContent = text;
        cell.style.padding = '12px';
        cell.style.borderBottom = '1px solid rgba(200, 200, 200, 0.5)';
        cell.style.borderRight = '1px solid rgba(200, 200, 200, 0.3)'; // Subtle vertical border for each cell
        cell.style.textAlign = textAlign;
        cell.style.fontSize = '12px';
        cell.style.overflow = 'hidden';
        cell.style.textOverflow = 'ellipsis';
        cell.classList.add('theme-aware-cell');
        if (textAlign === 'left' && text === variable.value) {
          cell.style.width = '65%';
        }
        return cell;
      };

      // Name
      const nameCell = createCell(variable.name);
      row.appendChild(nameCell);

      // Type
      const typeCell = createCell(Array.isArray(variable.type) ? variable.type.join(', ') : variable.type);
      row.appendChild(typeCell);

      // Helper function to format sizes
      function formatSize(bytes: number) {
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        if (bytes == 0) return '0 Byte';
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return (bytes / Math.pow(1024, i)).toFixed(1) + ' ' + sizes[i];
      }

      // Size cell
      const sizeCell = createCell(formatSize(variable.size), 'right');
      row.appendChild(sizeCell);

      // Value
      const valuePreview = Array.isArray(variable.value)
        ? variable.value.slice(0, 5).join(', ') + ' ...'
        : variable.value.toString();
      const valCell = createCell(valuePreview);
      valCell.style.whiteSpace = 'nowrap';
      valCell.style.width = '65%';
      row.appendChild(valCell);

      table.appendChild(row);
    });

    content.appendChild(table);
    this.containerEl.appendChild(content);

    // CSS to adapt to Obsidian's theme
    const style = document.createElement('style');
    style.textContent = `
      .theme-aware-title, .theme-aware-table, .theme-aware-cell, .theme-aware-row {
        color: var(--text-normal);
        background: var(--background-primary);
      }
      .theme-aware-row {
        background: var(--background-secondary);
      }
      .theme-aware-row:hover {
        background: var(--background-hover);
      }
      .theme-aware-table th {
        color: var(--text-muted);
      }
    `;
    document.head.appendChild(style);
  }
}

// Class to launch R help view in a new window
class RHelpView extends ItemView {
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
    return 'info'; // Choose an appropriate icon
  }

  async onOpen() {
    console.log('RHelpView opened');
    this.contentEl.empty();
    this.render();
  }

  async onClose() {
    console.log('RHelpView closed');
    // Cleanup if needed
  }

  public updateHelpContent(helpContent: string) {
    console.log('Updating help content in RHelpView with content:', helpContent);
    this.helpContent = helpContent;
    this.render();
  }

  private render() {
    console.log('RHelpView render called with help content:', this.helpContent);
    this.contentEl.empty();

    const content = document.createElement('div');
    content.style.padding = '1px';
    content.style.overflowY = 'auto';
    content.style.fontFamily = 'sans-serif'; // Default to sans-serif for regular text

    content.innerHTML = this.helpContent; // Render as HTML

    // Apply styles to tighten vertical spacing
    const style = document.createElement('style');
    style.innerHTML = `
        code {
            font-family: 'Monaco', 'Courier New', monospace;
            font-size: 0.95em;
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 4px;
        }
    `;
    content.appendChild(style);
    
    this.contentEl.appendChild(content);
}



}

class MyPluginSettingTab extends PluginSettingTab {
  plugin: CombinedPlugin; // Updated type


  constructor(app: App, plugin: CombinedPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'R Integration Settings' });

// Function to process path for Windows compatibility with type annotation
function formatPathForWindows(path: string): string {
  if (navigator.platform.includes('Win')) {
    // First, replace all single backslashes with double backslashes
    // Then, replace all forward slashes with double backslashes
    return path.replace(/\\/g, '\\\\').replace(/\//g, '\\\\');
  }
  return path;
}


// Setting for R Executable Path
new Setting(containerEl)
  .setName('Path to R Executable')
  .setDesc('Specify the full path to your R executable.')
  .addText((text) =>
    text
       .setPlaceholder('/usr/local/bin/R')
      .setValue(formatPathForWindows(this.plugin.settings.rExecutablePath))
      .onChange(async (value) => {
        const formattedValue = formatPathForWindows(value.trim());
        console.log('R Executable Path changed to: ' + formattedValue);
        
        this.plugin.settings.rExecutablePath = formattedValue;
        await this.plugin.saveSettings();
        new Notice('R executable path updated successfully.');
      })
  );

// Setting for RStudio Pandoc Path
new Setting(containerEl)
  .setName('Path to RStudio Pandoc')
  .setDesc('Specify the full path to your RStudio Pandoc installation.')
  .addText((text) =>
    text
      .setPlaceholder('/opt/homebrew/bin/')
      .setValue(formatPathForWindows(this.plugin.settings.rstudioPandocPath))
      .onChange(async (value) => {
        const formattedValue = formatPathForWindows(value.trim());
        console.log('RStudio Pandoc Path changed to: ' + formattedValue);
        
        this.plugin.settings.rstudioPandocPath = formattedValue;
        await this.plugin.saveSettings();
        new Notice('RStudio Pandoc path updated successfully.');
      })
  );

  // Setting for Quarto Executable Path
  new Setting(containerEl)
  .setName('Quarto Executable Path')
  .setDesc('Specify the full path to your Quarto executable. Example: /usr/local/bin/quarto')
  .addText((text) =>
    text
      .setPlaceholder('/usr/local/bin/quarto')
      .setValue(this.plugin.settings.quartoExecutablePath)
      .onChange(async (value) => {
        console.log('Quarto Executable Path changed to: ' + value);
        this.plugin.settings.quartoExecutablePath = value.trim();
        await this.plugin.saveSettings();
        new Notice('Quarto executable path updated successfully.');
      })
  );

  // Toggle for menu
  new Setting(containerEl)
  .setName('Enable Floating Menu')
  .setDesc('Toggle to show or hide the floating menu in the editor.')
  .addToggle(toggle =>
    toggle
      .setValue(this.plugin.settings.enableFloatingMenu)
      .onChange(async (value) => {
        console.log('Floating Menu Toggle:', value);
        this.plugin.settings.enableFloatingMenu = value;
        await this.plugin.saveSettings();
        if (value) {
          this.plugin.floatingMenu.onLoad();
          new Notice('Floating Menu Enabled.');
        } else {
          this.plugin.floatingMenu.onUnload();
          new Notice('Floating Menu Disabled.');
        }
      })
  );
}
}

export default class CombinedPlugin extends Plugin {
  // Settings
  settings: CombinedPluginSettings;

  // R Code Evaluator
  private rProcesses: Map<string, ChildProcessWithoutNullStreams> = new Map();

  // Floating Menu
  floatingMenu: FloatingMenu;

  // Define unique view types
  private VIEW_TYPE_R_ENVIRONMENT = VIEW_TYPE_R_ENVIRONMENT;
  private VIEW_TYPE_R_HELP = VIEW_TYPE_R_HELP;

  // Define markers and constants (from RCodeEvaluatorPlugin)
  // ... (Include any necessary constants)

  async onload() {
    console.log('Loading Combined Floating Menu and R Code Evaluator Plugin');

    // Load settings
    await this.loadSettings();

    // Initialize Floating Menu
    this.floatingMenu = new FloatingMenu(this);
    if (this.settings.enableFloatingMenu) {
      this.floatingMenu.onLoad();
    }

    // Add a settings tab
    this.addSettingTab(new MyPluginSettingTab(this.app, this));

    // Register the R environment and help views
    this.registerView(this.VIEW_TYPE_R_ENVIRONMENT, (leaf) => new REnvironmentView(leaf));
    this.registerView(this.VIEW_TYPE_R_HELP, (leaf) => new RHelpView(leaf));

    // Ensure the R Environment and Help views are added to the right sidebar
    this.app.workspace.onLayoutReady(() => {
      console.log('Workspace is ready, adding R Environment and Help views');

      // Add R Environment view to the right sidebar
      if (this.app.workspace.getLeavesOfType(this.VIEW_TYPE_R_ENVIRONMENT).length === 0) {
        const leaf = this.app.workspace.getRightLeaf(false);
        if (leaf) {
          leaf
            .setViewState({
              type: this.VIEW_TYPE_R_ENVIRONMENT,
              active: true,
            })
            .then(() => {
              console.log('REnvironmentView added to the right pane');
            })
            .catch((err) => {
              console.error('Failed to add REnvironmentView to the right pane:', err);
            });
        } else {
          console.error('Failed to obtain the right workspace leaf for REnvironmentView.');
        }
      } else {
        console.log('REnvironmentView already exists in the workspace');
      }

      // Add R Help view to the right sidebar
      if (this.app.workspace.getLeavesOfType(this.VIEW_TYPE_R_HELP).length === 0) {
        const leaf = this.app.workspace.getRightLeaf(true);
        if (leaf) {
          leaf
            .setViewState({
              type: this.VIEW_TYPE_R_HELP,
              active: true,
            })
            .then(() => {
              console.log('RHelpView added to the right pane');
            })
            .catch((err: any) => {
              console.error('Failed to add RHelpView to the right pane:', err);
            });
        } else {
          console.error('Failed to obtain the right workspace leaf for RHelpView.');
        }
      } else {
        console.log('RHelpView already exists in the workspace');
      }
    });

    // Register commands from RCodeEvaluatorPlugin
    this.registerRCommands();


    console.log('Combined Plugin loaded successfully');
  }

  onunload() {
    console.log('Unloading Combined Floating Menu and R Code Evaluator Plugin');

    // Unload Floating Menu
    this.floatingMenu.onUnload();

    // Terminate all R processes
    this.rProcesses.forEach((rProcess, notePath) => {
      console.log(`Terminating R process for note: ${notePath}`);
      rProcess.kill();
    });
    this.rProcesses.clear();

    // Detach the R environment and help views
    this.app.workspace.getLeavesOfType(this.VIEW_TYPE_R_ENVIRONMENT).forEach((leaf) => {
      console.log('Detaching REnvironmentView from workspace');
      leaf.detach();
    });

    this.app.workspace.getLeavesOfType(this.VIEW_TYPE_R_HELP).forEach((leaf) => {
      console.log('Detaching RHelpView from workspace');
      leaf.detach();
    });

    console.log('Combined Plugin unloaded successfully');
  }

  // Settings management
  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
  

  // Register RCodeEvaluatorPlugin commands
  registerRCommands() {
    // Register the command to run the current code chunk
    this.addCommand({
      id: 'run-current-code-chunk',
      name: 'Run Current Code Chunk',
      editorCallback: (editor: Editor, view: MarkdownView) => {
        if (!view.file) {
          new Notice('No file associated with the current view.');
          console.error('No file associated with the current view.');
          return;
        }

        const noteTitle = view.file.basename; // Extract the note title
        this.runCurrentCodeChunk(editor, view, noteTitle); // Pass it to the method
      },
      hotkeys: [
        {
          modifiers: ['Mod'], // 'Mod' is 'Cmd' on Mac and 'Ctrl' on Windows/Linux
          key: 'r',
        },
      ],
    });

    // Register the command to export note with Quarto
    this.addCommand({
      id: 'export-note-with-quarto',
      name: 'Export Note with Quarto',
      callback: () => this.exportNoteWithQuarto(),
    });
  }
   
    // Ensure only this runCommand method exists
    runCommand(commandId: string) {
      console.log(`Executing command: ridian_v3:${commandId}`);
      (this.app as any).commands.executeCommandById(commandId);
       //this.app.commands.executeCommandById(commandId)
       
    }

     



  // ... (Include all methods from RCodeEvaluatorPlugin)
  // For brevity, collapse unchanged methods or indicate to include them

 /**
 * Applies wrapping characters (e.g., bold, italic) around the selected text.
 * If no text is selected, inserts the wrappers and places the cursor inside them.
 * @param wrapper - The characters to wrap around the text.
 */
applyWrapping(wrapper: string) {
	const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeLeaf) return;
  
	const editor = activeLeaf.editor;
	const selection = editor.getSelection();
  
	if (selection) {
	  // Replace the selection with wrapped text
	  editor.replaceSelection(`${wrapper}${selection}${wrapper}`);
  
	  // Calculate the new cursor position (inside the wrappers)
	  const cursor = editor.getCursor();
	  const start = { line: cursor.line, ch: cursor.ch - selection.length - wrapper.length };
	  const end = { line: cursor.line, ch: cursor.ch - wrapper.length };
  
	  // Select the area inside the wrappers
	  editor.setSelection(start, end);
  
	  // Log the new cursor position for debugging
	  console.log(`Wrapped text from (${start.line}, ${start.ch}) to (${end.line}, ${end.ch})`);
	} else {
	  // Insert the wrappers at the current cursor position
	  const cursor = editor.getCursor(); // Define cursor here
	  editor.replaceRange(`${wrapper}${wrapper}`, cursor);
  
	  // Calculate the cursor position (inside the wrappers)
	  const newCursor = { line: cursor.line, ch: cursor.ch + wrapper.length };
  
	  // Place the cursor inside the wrappers
	  editor.setSelection(newCursor, newCursor);
  
	  // Log the new cursor position for debugging
	  console.log(`Inserted wrappers at (${newCursor.line}, ${newCursor.ch})`);
	}
  
	// Ensure the editor is focused
	editor.focus();
  }

/**
 * Applies an HTML tag around the selected text.
 * @param tag - The HTML tag to apply (e.g., 'u' for underline).
 */
applyHtmlTag(tag: string) {
  try {
    const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!activeLeaf) {
      console.error('No active Markdown view found.');
      new Notice('No active Markdown view found.');
      return;
    }

    const editor = activeLeaf.editor;
    const selection = editor.getSelection();
    const openTag = `<${tag}>`;
    const closeTag = `</${tag}>`;

    if (selection) {
      // Wrap the selected text with the specified HTML tags
      editor.replaceSelection(`${openTag}${selection}${closeTag}`);
      
      // Calculate the new cursor position after the opening tag
      const cursor = editor.getCursor();
      const newCh = cursor.ch - closeTag.length;
      
      // Set the cursor position to just after the opening tag
      editor.setCursor({ line: cursor.line, ch: newCh });
      

    } else {
      // Insert the HTML tags at the current cursor position
      editor.replaceRange(`${openTag}${closeTag}`, editor.getCursor());
      
      // Get the updated cursor position
      const cursor = editor.getCursor();
      
      // Move the cursor between the inserted tags
      editor.setCursor({ line: cursor.line, ch: cursor.ch - closeTag.length });
      

    }

    // Ensure the editor is focused after the operation
    editor.focus();
  } catch (error) {
    console.error('Error in applyHtmlTag:', error);
    new Notice(`Failed to apply HTML tag: ${error.message}`);
  }
}


/**
 * Applies a heading to the current line.
 * @param level - The heading level (1-6).
 */
applyHeading(level: number) {
  const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
  if (activeLeaf) {
    const editor = activeLeaf.editor;
    const cursor = editor.getCursor();
    const lineContent = editor.getLine(cursor.line);

    const headingPrefix = '#'.repeat(level) + ' ';
    if (lineContent.startsWith('#')) {
      // Replace existing heading
      const lineWithoutHashes = lineContent.replace(/^#+\s*/, '');
      editor.replaceRange(
        headingPrefix + lineWithoutHashes,
        { line: cursor.line, ch: 0 },
        { line: cursor.line, ch: lineContent.length }
      );
    } else {
      // Add heading
      editor.replaceRange(headingPrefix, { line: cursor.line, ch: 0 });
    }

    // Set cursor after heading prefix
    const newCh = headingPrefix.length;
    editor.setCursor({ line: cursor.line, ch: newCh });
    console.log(`Cursor moved to (${cursor.line}, ${newCh}) after applying heading level ${level}.`);

    // Ensure the editor is focused
    editor.focus();
  }
}


/**
 * Inserts an R code block at the current cursor position.
 * After insertion, places the cursor on the first line inside the code block.
 */
insertCodeBlock(language: string) {
	const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
	if (!activeLeaf) return;
  
	const editor = activeLeaf.editor;
	const cursor = editor.getCursor();
  
	// Define the R code block template
	const codeBlock = `\`\`\`${language}\n`;
	const codeBlockEnd = `\n\`\`\`\n`;
  
	// Insert the opening backticks and language
	editor.replaceRange(codeBlock, cursor);
  
	// Insert the closing backticks after two newlines
	editor.replaceRange(codeBlockEnd, { line: cursor.line, ch: cursor.ch + codeBlock.length });
  
	// Calculate the new cursor position inside the code block
	const newCursor = { line: cursor.line + 1, ch: 0 };
  
	// Move the cursor inside the code block
	editor.setSelection(newCursor, newCursor);
  
	// Optional: Log the new cursor position for debugging
	console.log(`Inserted ${language} code block at (${newCursor.line}, ${newCursor.ch}).`);
  
	// Ensure the editor is focused
	editor.focus();
  }
  
/**
 * Applies text alignment by wrapping the selected text in a div with text-align style.
 * @param alignment - The desired text alignment ('left', 'center', 'right', 'justify').
 */
applyAlignment(alignment: 'left' | 'center' | 'right' | 'justify') {
  const activeLeaf = this.app.workspace.getActiveViewOfType(MarkdownView);
  if (activeLeaf) {
    const editor = activeLeaf.editor;
    const selection = editor.getSelection();
    const openDiv = `<div style="text-align: ${alignment};">`;
    const closeDiv = `</div>`;
    
    if (selection) {
      // Wrap the selected text with the alignment div
      editor.replaceSelection(`${openDiv}\n${selection}\n${closeDiv}`);
      
      // Optionally, place the cursor after the closing div
      const cursor = editor.getCursor();
      editor.setCursor({ line: cursor.line + 1, ch: 0 });
    } else {
      // Insert the alignment div at the current cursor position
      editor.replaceRange(`${openDiv}\n\n${closeDiv}`, editor.getCursor());
      
      // Move the cursor inside the newly inserted div
      const cursor = editor.getCursor();
      editor.setCursor({ line: cursor.line - 1, ch: openDiv.length + 1 });
    }
    
    // Ensure the editor is focused after the operation
    editor.focus();
  }
}


  // RCodeEvaluatorPlugin specific methods
  // Ensure these are included and properly namespaced to avoid conflicts

  

  // In CombinedPlugin class
 
    // Function to generate a unique ID based on the code chunk's position
    generateUniqueId(position: number): string {
      return createHash('sha256').update(position.toString()).digest('hex').substring(0, 8);
    }

  // Run code chunk in editing mode
runCurrentCodeChunk(editor: Editor, view: MarkdownView, noteTitle: string) {
  const cursor = editor.getCursor();
  const { startLine, endLine: originalEndLine, code, existingLabel, options } = this.getCurrentCodeChunk(editor, cursor.line);

  let endLine = originalEndLine; // We'll adjust this if necessary

  if (code) {
    const uniqueId = existingLabel || this.generateUniqueId(startLine); // Use existing label or generate new based on position
    const notePath = view.file?.path;
    if (notePath) {
      if (!existingLabel) {
        // Insert the generated label into the code chunk
        const linesInserted = this.insertLabel(editor, startLine, uniqueId);
        // Adjust endLine since we've inserted new lines
        endLine += linesInserted;
      }

      console.log(`Running current code chunk in note: ${notePath} with ID: ${uniqueId}`);

      // Determine if it's a help request
      const isHelpRequest =
        /\?\s*\w+/.test(code) ||        // Detects patterns like "?functionName"
        /help\s*\(\s*\w+\s*\)/.test(code); // Detects patterns like "help(functionName)"

      this.runRCodeInSession(notePath, code, noteTitle, uniqueId, isHelpRequest, options) // Pass the options
        .then(({ result, imagePaths, widgetPaths, helpContent }) => {
          console.log('R code executed successfully');

          if (isHelpRequest) {
            // Help content is already handled inside runRCodeInSession
            new Notice('Help content updated in the sidebar.');
          } else {
            // Handle options
            const includeOption = options['include'] == 'false';
            const outputOption = options['output'] == 'false';
          

            
              if (result || imagePaths.length > 0 || widgetPaths.length > 0) {
                // Insert output and images into the editor if output is not suppressed and there's content
                this.insertOutputWithCallout(editor, endLine, result, imagePaths, widgetPaths, uniqueId, options);
              }
              if(outputOption){
                // Output is suppressed or there's no content
                // Remove existing output callout if present
                this.removeOutputCallout(editor, uniqueId);
              }
            
              if (includeOption) {
              // Include is false, remove existing output callout if present
              this.removeOutputCallout(editor, uniqueId);
            }
            
          }
        })
        .catch((err) => {
          console.error('Error executing R code:', err);
          // Check if errors should be included
          if (options['error'] !== 'false' && options['include'] !== 'false' && options['output'] !== 'false') {
            this.insertOutputWithCallout(editor, endLine, `Error:\n${err}`, [], [], uniqueId, options);
          } else {
            // Remove existing output callout if present
            this.removeOutputCallout(editor, uniqueId);
          }
        });
    } else {
      new Notice('No file associated with the current view.');
      console.error('No file associated with the current view.');
    }
  } else {
    new Notice('No R code chunk found at the cursor position.');
    console.log('No R code chunk found at the cursor position.');
  }
}



// Get the current code chunk based on cursor position
getCurrentCodeChunk(
  editor: Editor,
  cursorLine: number
): {
  startLine: number;
  endLine: number;
  code: string;
  existingLabel: string | null;
  options: { [key: string]: string };
} {
  const totalLines = editor.lineCount();
  let startLine = cursorLine;
  let endLine = cursorLine;
  let existingLabel: string | null = null;
  let options: { [key: string]: string } = {};

  // Find the start of the code chunk
  while (startLine >= 0 && !this.isCodeChunkStart(editor.getLine(startLine))) {
    startLine--;
  }

  // If not found, return invalid
  if (startLine < 0) {
    return { startLine: -1, endLine: -1, code: '', existingLabel: null, options: {} };
  }

  // Find the end of the code chunk
  endLine = startLine + 1;
  while (endLine < totalLines && !editor.getLine(endLine).startsWith('```')) {
    endLine++;
  }

  if (endLine >= totalLines) {
    // No closing ```
    return { startLine: -1, endLine: -1, code: '', existingLabel: null, options: {} };
  }

  // Parse the label and options from the code chunk
  existingLabel = this.parseChunkLabel(editor, startLine);
  options = this.parseChunkOptions(editor, startLine);

  // Extract the code chunk content, skipping options lines
  const codeLines = [];
  for (let i = startLine + 1; i < endLine; i++) {
    const line = editor.getLine(i);
    // Skip lines starting with '#|' as they are options
    if (!line.trim().startsWith('#|')) {
      codeLines.push(line);
    }
  }
  const code = codeLines.join('\n');

  console.log(`Found code chunk from line ${startLine} to ${endLine} with label: ${existingLabel}`);
  return { startLine, endLine, code, existingLabel, options };
}

// Helper method to check if a line is the start of a code chunk
isCodeChunkStart(line: string): boolean {
  // Remove leading whitespace
  line = line.trim();
  // Match lines that start with ```r or ```{r}
  return /^```{?r/.test(line);
}


// Helper method to parse options from the code chunk
parseChunkOptions(editor: Editor, startLine: number): { [key: string]: string } {
  const options: { [key: string]: string } = {};
  let lineIndex = startLine + 1;
  const totalLines = editor.lineCount();

  while (lineIndex < totalLines) {
    const line = editor.getLine(lineIndex).trim();
    if (line.startsWith('#|')) {
      // Extract the option key and value
      const optionMatch = line.match(/^#\|\s*(\w+)\s*:\s*(.*)$/);
      if (optionMatch) {
        const key = optionMatch[1];
        let value = optionMatch[2];

        // Remove surrounding quotes if present
        value = value.replace(/^["']|["']$/g, '');

        options[key] = value;
      }
      lineIndex++;
    } else if (line === '' || line.startsWith('#')) {
      // Skip empty lines or comments
      lineIndex++;
    } else {
      // Reached the end of options
      break;
    }
  }

  return options;
}


// Helper method to parse the label from the code chunk options
parseChunkLabel(editor: Editor, startLine: number): string | null {

    let lineIndex = startLine + 1;
    const totalLines = editor.lineCount();

    while (lineIndex < totalLines) {
      const line = editor.getLine(lineIndex).trim();
      if (line.startsWith('#|')) {
        // Extract the option key and value
        const optionMatch = line.match(/^#\|\s*(\w+)\s*:\s*(.*)$/);
        if (optionMatch) {
          const key = optionMatch[1];
          let value = optionMatch[2];

          // Remove surrounding quotes if present
          value = value.replace(/^["']|["']$/g, '');

          if (key === 'label') {
            return value;
          }
        }
        lineIndex++;
      } else if (line === '' || line.startsWith('#')) {
        // Skip empty lines or comments
        lineIndex++;
      } else {
        // Reached the end of options
        break;
      }
    
  }

  return null;
}

// Insert the generated label into the code chunk
insertLabel(editor: Editor, startLine: number, uniqueId: string): number {
  const fenceLine = editor.getLine(startLine).trim();

    // Insert label into Quarto chunk options as a `#| label: ...` line
    let insertPosition = startLine + 1;
    const totalLines = editor.lineCount();

    // Find the position after existing `#|` options
    while (insertPosition < totalLines) {
      const line = editor.getLine(insertPosition).trim();
      if (line.startsWith('#|')) {
        insertPosition++;
      } else {
        break;
      }
    }

    // Insert the label option
    editor.replaceRange(`#| label: ${uniqueId}\n`, { line: insertPosition, ch: 0 });
    console.log(`Inserted label "#| label: ${uniqueId}" into code chunk at line ${insertPosition}`);
    return 1; // We inserted one line
  
}



// Insert or replace the output callout with images
insertOutputWithCallout(
  editor: Editor,
  endLine: number,
  output: string,
  imagePaths: string[],
  widgetPaths: string[],
  uniqueId: string,
  options: { [key: string]: string } // Add this parameter
) {
  console.log('Inserting or updating output callout and images into the editor');



 // Prepare the content lines
 const contentLines: string[] = [];

 // Prepare the output content, prefixing each line with '> '
 if (output && output.trim() !== '') {
   const outputLines = output.trim().split('\n').map((line) => '> ' + line);
   contentLines.push(...outputLines);
 }

 // Add new image and animation links inside the callout
 imagePaths.forEach((imagePath) => {
   const vaultImagePath = `${imagePath}`; // Path in the vault
   const imageMarkdown = `![center|480](${vaultImagePath})`;
   contentLines.push(`> ${imageMarkdown}`);
 });

 widgetPaths.forEach((widgetPath) => {
   const widgetMarkdown = `<iframe src="${widgetPath}" width="100%" height="680px"></iframe>`;
   contentLines.push(`> ${widgetMarkdown}`);
 });

 // If there's no content, avoid inserting an empty callout
 if (contentLines.length === 0) {
   console.log('No output, images, or widgets to insert. Skipping callout insertion.');
   return;
 }
  // Define the callout block with unique ID
  let outputContent = `> [!OUTPUT]+ {#output-${uniqueId}}\n`;

  // Append content lines to the outputContent
  outputContent += contentLines.join('\n') + '\n';
  // Ensure there's a newline after the callout content
  outputContent += '> \n';


 // Read the current content to check for existing output
 let existingOutputStart = -1;
 let existingOutputEnd = -1;
 const totalLines = editor.lineCount();

 for (let i = 0; i < totalLines; i++) {
   const line = editor.getLine(i);
   if (line.trim() === `> [!OUTPUT]+ {#output-${uniqueId}}`) {
     existingOutputStart = i;
     // Find the end of the callout block
     existingOutputEnd = i;
     while (existingOutputEnd + 1 < totalLines) {
       const nextLine = editor.getLine(existingOutputEnd + 1);
       // Check if the next line is part of the callout
       if (!nextLine.startsWith('> ') && nextLine.trim() !== '') {
         break;
       }
       existingOutputEnd++;
     }
     break;
   }
 }

 if (existingOutputStart !== -1 && existingOutputEnd !== -1) {
   // Replace the existing callout block
   const from = { line: existingOutputStart, ch: 0 };
   const to = { line: existingOutputEnd + 1, ch: 0 };
   editor.replaceRange(outputContent + '\n', from, to);
   console.log(`Replaced existing output callout for ID: ${uniqueId}`);
 } else {
   // Insert the new callout block after the code chunk
   const insertPosition = { line: endLine + 1, ch: 0 };
   // Insert a leading newline to separate from the code chunk
   editor.replaceRange('\n' + outputContent + '\n', insertPosition);
   console.log(`Inserted new output callout for ID: ${uniqueId}`);
 }
}

// Remove the output callout with the given unique ID
removeOutputCallout(editor: Editor, uniqueId: string) {
  console.log(`Removing output callout for ID: ${uniqueId} if it exists`);

  // Find the existing callout
  let existingOutputStart = -1;
  let existingOutputEnd = -1;
  const totalLines = editor.lineCount();

  for (let i = 0; i < totalLines; i++) {
    const line = editor.getLine(i);
    if (line.trim() === `> [!OUTPUT]+ {#output-${uniqueId}}`) {
      existingOutputStart = i;
      // Find the end of the callout block
      existingOutputEnd = i;
      while (existingOutputEnd + 1 < totalLines) {
        const nextLine = editor.getLine(existingOutputEnd + 1);
        // Check if the next line is part of the callout
        if (!nextLine.startsWith('> ') && nextLine.trim() !== '') {
          break;
        }
        existingOutputEnd++;
      }
      break;
    }
  }

  if (existingOutputStart !== -1 && existingOutputEnd !== -1) {
    // Remove the existing callout block
    const from = { line: existingOutputStart, ch: 0 };
    const to = { line: existingOutputEnd + 1, ch: 0 };
    editor.replaceRange('', from, to);
    console.log(`Removed existing output callout for ID: ${uniqueId}`);
  } else {
    console.log(`No existing output callout found for ID: ${uniqueId}`);
  }
}


  // Get or create R process for the note
  getRProcess(notePath: string): ChildProcessWithoutNullStreams {
    let rProcess = this.rProcesses.get(notePath);
    if (!rProcess) {
      rProcess = this.startRProcess(notePath);
    }
    return rProcess;
  }

  // Start R process
  startRProcess(notePath: string): ChildProcessWithoutNullStreams {
    const rExecutable = this.settings.rExecutablePath || '/usr/local/bin/R'; // Use user-specified path or default
    console.log(`Starting R process for note: ${notePath} using executable: ${rExecutable}`);
   

  // User feedback if R path fails:
    if (!fs.existsSync(rExecutable)) {
      new Notice(`R executable not found at ${rExecutable}. Please update the path in settings.`);
      console.error(`R executable not found at ${rExecutable}.`);
      throw new Error(`R executable not found at ${rExecutable}.`);
    }
    
    // Get the current environment variables
  const env = { ...process.env };



    const rProcess = spawn(rExecutable, ['--vanilla', '--quiet', '--slave'], { stdio: 'pipe', env });

    // Handle errors
    rProcess.on('error', (err) => {
      console.error(`Failed to start R process for ${notePath}:`, err);
    });

    // Initialize the R session
    const initCode = `
library(jsonlite)
if (!exists("user_env")) {
  user_env <- new.env()
}


# prevent browser:
options(browser='false')
options(bitmapType = 'cairo')
options(device = function(...) jpeg(filename = tempfile(), width=800, height=600, ...))
    `;
    rProcess.stdin.write(initCode + '\n');

    // Store the process
    this.rProcesses.set(notePath, rProcess);
    console.log(`R process started and stored for note: ${notePath}`);

    return rProcess;
  };

  async runRCodeInSession(
    notePath: string,
    code: string,
    noteTitle: string,
    uniqueId: string,
    isHelpRequest: boolean,
    options: { [key: string]: string } // New parameter
  ): Promise<{ result: string; imagePaths: string[]; widgetPaths: string[]; helpContent: string }> {
  
  
    
    console.log('runRCodeInSession called for note:', notePath, 'with ID:', uniqueId);
    const rProcess = this.getRProcess(notePath);

    return new Promise(async (resolve, reject) => {
      let output = '';
      let errorOutput = '';

      // Create a temporary directory for R to output plots
      const tempDir = await mkdtempAsync(path.join(os.tmpdir(), 'rplots-'));
      // const tempDirEscaped = tempDir.replace(/\\/g, '/'); // Ensure forward slashes

      const tempDirEscaped = process.platform === 'win32' 
      ? tempDir.replace(/\\/g, '\\\\') 
      :tempDir.replace(/\\/g, '/');

    
      // Generate a temp file path for the help content
      const tempHelpFilePath = path.join(tempDirEscaped, `help_${uniqueId}.txt`);
      //const tempHelpFilePathR = tempHelpFilePath.replace(/\\/g, '/');

      const tempHelpFilePathR = process.platform === 'win32' 
      ? tempHelpFilePath.replace(/\\/g, '\\\\') 
      :tempHelpFilePath .replace(/\\/g, '/');



      const marker = `__END_OF_OUTPUT__${Date.now()}__`;
      const imageMarker = `__PLOT_PATH__`;
      const envMarker = `__ENVIRONMENT_DATA__${Date.now()}__`;
      const widgetMarker = `__WIDGET_PATH__`; // Define the widget marker

      const optsCode = `
      opts <- list(
        echo = ${options['echo'] !== 'false' ? 'TRUE' : 'FALSE'},
        warning = ${options['warning'] !== 'false' ? 'TRUE' : 'FALSE'},
        error = ${options['error'] !== 'false' ? 'TRUE' : 'FALSE'},
        include = ${options['include'] !== 'false' ? 'TRUE' : 'FALSE'},
        output = ${options['output'] !== 'false' ? 'TRUE' : 'FALSE'}
      )
      `;

      // Prepare code to send to R using the 'evaluate' package
      const wrappedCode = `
library(evaluate)
library(jsonlite)
library(htmlwidgets)
Sys.setenv(RSTUDIO_PANDOC='${this.settings.rstudioPandocPath}')


${optsCode}

# Define our custom print function
custom_print_htmlwidget <- function(x, ..., viewer = NULL) {
    # Generate a unique filename
    
    widgetFileName <- paste0("widget_${uniqueId}_",".html")
    widgetFilePath <- file.path("${tempDirEscaped}", widgetFileName)
    # Save the widget to the file
    saveWidget(x, widgetFilePath, selfcontained = TRUE)
    # Output a marker to indicate the widget was saved
    cat("${widgetMarker}", widgetFileName, "\\n", sep="")
}

# Replace the original function in the 'htmlwidgets' namespace
environment(custom_print_htmlwidget) <- asNamespace('htmlwidgets')
assignInNamespace("print.htmlwidget", custom_print_htmlwidget, envir = as.environment("package:htmlwidgets"))



timecheck <- Sys.time()

# override help
.getHelpFile <- function(file)
{
    path <- dirname(file)
    dirpath <- dirname(path)
    if(!file.exists(dirpath))
        stop(gettextf("invalid %s argument", sQuote("file")), domain = NA)
    pkgname <- basename(dirpath)
    RdDB <- file.path(path, pkgname)
    if(!file.exists(paste(RdDB, "rdx", sep = ".")))
        stop(gettextf("package %s exists but was not installed under R >= 2.10.0 so help cannot be accessed", sQuote(pkgname)), domain = NA)
    tools:::fetchRdDB(RdDB, basename(file))
}


print.help_files_with_topic <- function(x, ...)
{
  browser <- getOption("browser")
  topic <- attr(x, "topic")
  type <- "text"
  paths <- as.character(x)
  
  if(!length(paths)) {
    writeLines(c(gettextf("No documentation for %s in specified packages and libraries:",
                          sQuote(topic)),
                 gettextf("you could try %s",
                          sQuote(paste0("??", topic)))))
    return(invisible(x))
  }
  
  port <- NULL
  
  if(attr(x, "tried_all_packages")) {
    paths <- unique(dirname(dirname(paths)))
    msg <- gettextf("Help for topic %s is not in any loaded package but can be found in the following packages:",
                    sQuote(topic))
    
      writeLines(c(strwrap(msg), "",
                   paste(" ",
                         formatDL(c(gettext("Package"), basename(paths)),
                                  c(gettext("Library"), dirname(paths)),
                                  indent = 22))))
    } else {
    if(length(paths) > 1L) {
      file <- paths[1L]
      p <- paths
      msg <- gettextf("Help on topic %s was found in the following packages:",
                      sQuote(topic))
      paths <- dirname(dirname(paths))
      txt <- formatDL(c("Package", basename(paths)),
                      c("Library", dirname(paths)),
                      indent = 22L)
      writeLines(c(strwrap(msg), "", paste(" ", txt), ""))
      if(interactive()) {
        fp <- file.path(paths, "Meta", "Rd.rds")
        tp <- basename(p)
        titles <- tp
        if(type == "html" || type == "latex")
          tp <- tools::file_path_sans_ext(tp)
        for (i in seq_along(fp)) {
          tmp <- try(readRDS(fp[i]))
          titles[i] <- if(inherits(tmp, "try-error"))
            "unknown title" else
              tmp[tools::file_path_sans_ext(tmp$File) == tp[i], "Title"]
        }
        txt <- paste0(titles, " {", basename(paths), "}")
        ## the default on menu() is currtently graphics = FALSE
        res <- menu(txt, title = gettext("Choose one"),
                    graphics = getOption("menu.graphics"))
        if(res > 0) file <- p[res]
      } else {
        writeLines(gettext("\nUsing the first match ..."))
      }
    }
    else
      file <- paths
    
    if(type == "text") {
      pkgname <- basename(dirname(dirname(file)))
      tools::Rd2HTML(.getHelpFile(file), out = "${tempHelpFilePathR}",
                            package = pkgname)

    }
    
  }
  
  invisible(x)
}

# Ensure user environment exists
if (!exists("user_env")) {
  user_env <- new.env()
}
# Evaluate code and capture results
results <- evaluate(${JSON.stringify(code)}, envir = user_env)

# Initialize outputs and image paths
outputs <- character()
imagePaths <- character()

# Process the results
for (res in results) {
  if (inherits(res, "source")) {
    # Ignore source elements
  } else if (inherits(res, "warning")) {
    if (opts$warning && opts$include) {
      outputs <- c(outputs, paste("Warning:", conditionMessage(res)))
    }
  } else if (inherits(res, "message")) {
    if (opts$output && opts$include) {
      outputs <- c(outputs, res$message)
    }
  } else if (inherits(res, "error")) {
    if (opts$error && opts$include) {
      outputs <- c(outputs, paste("Error:", conditionMessage(res)))
    }
  } else if (inherits(res, "character")) {
    if (opts$output && opts$include) {
      outputs <- c(outputs, res)
    }
  } else if (inherits(res, "recordedplot")) {
    if (opts$output && opts$include) {
      # Save the plot to a file using uniqueId
      timestamp <- format(Sys.time(), "%Y%m%d%H%M%S")
      plotFileName <- paste0("plot_${uniqueId}_", length(imagePaths) + 1, "_", timestamp, ".jpg")
      plotFilePath <- file.path("${tempDirEscaped}", plotFileName)
      jpeg(filename=plotFilePath, width=800, height=600)
      replayPlot(res)
      dev.off()
      imagePaths <- c(imagePaths, plotFileName)
    }
  }
}

# Attempt to retrieve the last animation, if any
if (opts$output && opts$include) {
  if (requireNamespace("gganimate", quietly = TRUE)) {
    anim <- try(gganimate::last_animation(), silent = TRUE)
    if (is.character(anim[1])) {
      if (file.info(anim[1])$mtime > timecheck) {
        timestamp <- format(Sys.time(), "%Y%m%d%H%M%S")
        animFileName <- paste0("animation_${uniqueId}_", timestamp, ".gif")
        animFilePath <- file.path("${tempDirEscaped}", animFileName)
        file.copy(anim[1], animFilePath)
        imagePaths <- c(imagePaths, animFileName)
      }
    }
  }
}

# Output the collected outputs
if (opts$output && opts$include && length(outputs) > 0) {
  cat(paste(outputs, collapse = "\\n"), "\\n")
}

# Output image markers
if (opts$output && opts$include) {
  for (img in imagePaths) {
    cat("${imageMarker}", img, "\\n", sep="")
  }
}

# Output the environment data
vars <- ls(envir = user_env)
env_list <- lapply(vars, function(var_name) {
  var_value <- get(var_name, envir = user_env)
  var_class <- class(var_value)
  var_size <- as.numeric(object.size(var_value)) # Convert to numeric
  var_val <- capture.output(str(var_value, max.level=0))

  list(
    name = var_name,
    type = var_class,
    size = var_size,
    value = var_val
  )
})




env_json <- toJSON(env_list, auto_unbox = TRUE)
cat("${envMarker}\\n")
cat(env_json)
cat("\\n${marker}\\n")
      `;

      console.log('Wrapped code sent to R:\n', wrappedCode);

      const onData = async (data: Buffer) => {
        const chunk = data.toString();
        console.log('Received data chunk:', chunk);
        output += chunk;

        if (output.includes(marker)) {
          console.log('Marker detected in R output');
          // Clean up listeners
          rProcess.stdout.off('data', onData);
          rProcess.stderr.off('data', onErrorData);
          
          // read help page:
          // Variables to hold parsed data
          let result = '';
          let helpContent = '';

          if (isHelpRequest) { // Conditional execution
            // Read the temp help file
            try {
              const helpDataRaw = await fs.promises.readFile(tempHelpFilePath, 'utf8');
              console.log('Read help content:', helpDataRaw);
              helpContent = helpDataRaw;
            } catch (e) {
              console.error('Failed to read help content:', e);
              helpContent = 'Failed to retrieve help content.';
            }
  
            // Update the help view
            const helpView = this.app.workspace.getLeavesOfType(VIEW_TYPE_R_HELP)[0]?.view as RHelpView;
            if (helpView) {
              helpView.updateHelpContent(helpContent);
            } else {
              console.log('RHelpView not found in the workspace');
            }
          }
        
          // Extract result and environment data
          
          let environmentData = '';
          if (output.includes(envMarker)) {
            const parts = output.split(envMarker);
            result = parts[0].trim();
            const envDataRaw = parts[1].split(marker)[0].trim();
            environmentData = envDataRaw;
          } else {
            result = output.split(marker)[0].trim();
          }

          console.log('Result before processing:', result);
          console.log('Environment data:', environmentData);

          // Escape imageMarker for regex
          const escapedImageMarker = imageMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

          // Extract image paths
          const imagePaths: string[] = [];
          const imageRegex = new RegExp(`${escapedImageMarker}(.*)`, 'g');
          let match;
          while ((match = imageRegex.exec(result)) !== null) {
            console.log('Image regex match:', match);
            if (match[1]) {
              const imageFileName = match[1].trim();
              imagePaths.push(imageFileName);
            } else {
              console.error('No image file name captured in regex match:', match);
            }
          }

          // Remove image markers from the result
          result = result.replace(new RegExp(`${escapedImageMarker}.*`, 'g'), '').trim();

          // Now, for each image, read the file and write it into the vault using Obsidian's API
          
for (const imageFileName of imagePaths) {
  const tempImagePath = path.join(tempDir, imageFileName);
  try {
    const imageData = await fs.promises.readFile(tempImagePath);
    // Write the image into the vault using Obsidian's API
    const vaultImagePath = `plots/${imageFileName}`; // Ensure 'plots/' directory
    // Ensure the 'plots' directory exists in the vault
    const plotsFolder = this.app.vault.getAbstractFileByPath('plots');
    if (!plotsFolder) {
      await this.app.vault.createFolder('plots');
      console.log('Created "plots" folder in the vault');
    }
    // Check if the file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(vaultImagePath);
    if (!existingFile) {
      await this.app.vault.createBinary(vaultImagePath, imageData);
      console.log(`Image file created in vault: ${vaultImagePath}`);
    } else {
      // File exists, overwrite it
      await this.app.vault.modifyBinary(existingFile as TFile, imageData);
      console.log(`Image file updated in vault: ${vaultImagePath}`);
    }
    // Update the image path to be relative to the vault
    imagePaths[imagePaths.indexOf(imageFileName)] = vaultImagePath;
  } catch (err) {
    console.error(`Error handling image file ${imageFileName}:`, err);
  }
}
          // Extract widget paths
      const widgetPaths: string[] = [];
      const escapedWidgetMarker = widgetMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const widgetRegex = new RegExp(`${escapedWidgetMarker}(.*)`, 'g');
      let widgetMatch;
      while ((widgetMatch = widgetRegex.exec(result)) !== null) {
        if (widgetMatch[1]) {
          const widgetFileName = widgetMatch[1].trim();
          widgetPaths.push(widgetFileName);
        }
      }

      // Remove widget markers from the result
      result = result.replace(new RegExp(`${escapedWidgetMarker}.*`, 'g'), '').trim();

      for (const widgetFileName of widgetPaths) {
        const tempWidgetPath = path.join(tempDir, widgetFileName);
        try {
          const widgetData = await fs.promises.readFile(tempWidgetPath, 'utf8');
          const vaultRelativeWidgetPath = `widgets/${widgetFileName}`;
      
          // Get the absolute path to the vault's base directory
          const vaultBasePath = (this.app.vault.adapter as any).getBasePath();
      
          // Ensure the 'widgets' directory exists in the vault
          const widgetsFolder = this.app.vault.getAbstractFileByPath('widgets');
          if (!widgetsFolder) {
            await this.app.vault.createFolder('widgets');
          }
      
          // Write the widget file to the vault
          const existingWidgetFile = this.app.vault.getAbstractFileByPath(vaultRelativeWidgetPath);
          if (!existingWidgetFile) {
            await this.app.vault.create(vaultRelativeWidgetPath, widgetData);
          } else {
            // File exists, overwrite it
            await this.app.vault.modify(existingWidgetFile as TFile, widgetData);
          }
      
          // Construct the absolute path to the widget file in the vault
          const vaultWidgetPath = path.join(vaultBasePath, vaultRelativeWidgetPath);
      
          // Convert the absolute path to a file URL
          const widgetFileUrl = pathToFileURL(vaultWidgetPath).href;
      
          // Update the widgetPaths array to contain the file URL
          widgetPaths[widgetPaths.indexOf(widgetFileName)] = widgetFileUrl;
        } catch (err) {
          console.error(`Error handling widget file ${widgetFileName}:`, err);
        }
      }
      

          // Clean up temporary directory
          try {
            // await fs.promises.rm(tempDir, { recursive: true, force: true });
            console.log(`Temporary directory ${tempDir} removed`);
          } catch (err) {
            console.error(`Error removing temporary directory ${tempDir}:`, err);
          }

          // Update the environment view
          const envView = this.app.workspace.getLeavesOfType(VIEW_TYPE_R_ENVIRONMENT)[0]
            ?.view as REnvironmentView;
          if (envView) {
            let envVariables: any[] = [];
            try {
              envVariables = JSON.parse(environmentData);
              console.log('Parsed environment variables:', envVariables);
            } catch (e) {
              console.error('Failed to parse environment data JSON:', e);
            }
            envView.updateEnvironmentData(noteTitle, envVariables); // Pass noteTitle here
          } else {
            console.log('REnvironmentView not found in the workspace');
          }

          // Reset output variables
          output = '';
          errorOutput = '';

          if (errorOutput) {
            reject(errorOutput.trim());
          } else {
            resolve({ result, imagePaths, widgetPaths, helpContent });
          }
        }
      };

      const onErrorData = (data: Buffer) => {
        const chunk = data.toString();
        console.error('Received error chunk from R:', chunk);
        errorOutput += chunk;
      };

      rProcess.stdout.on('data', onData);
      rProcess.stderr.on('data', onErrorData);

      // Send code to R process
      rProcess.stdin.write(wrappedCode + '\n');
      console.log('Wrapped R code sent to the R process');
    });
  }

  // Implement quarto export:

/**
 * Replaces all code fence markers from ```r to ```{r} to conform with Quarto's syntax.
 * @param content - The content to process.
 * @returns The content with updated code fence markers.
 */
replaceCodeFenceMarkers(content: string): string {
  // Use a regular expression to find all ```r and replace with ```{r}
  // The regex looks for lines that start with ``` followed by 'r' and possibly other language identifiers
  const codeFenceRegex = /^```r$/gmi;
  return content.replace(codeFenceRegex, '```{r}');
}


  addFrontMatter(content: string, activeFile: TFile): string {
  if (content.startsWith('---\n')) {
    // Front matter already exists
    return content;
  } else {
    const title = activeFile.basename;
    const frontMatter = `---
title: "${title}"
author: "Author Name"
date: today
format: html
---\n\n`;
    return frontMatter + content;
  }
}

sanitizeFileName(fileName: string): string {
  // Replace spaces and other invalid characters with underscores
  return fileName.replace(/[^a-zA-Z0-9-_]/g, '_');
}


stripOutputCallouts(content: string): string {
  // Use a regular expression to match and remove output callouts
  const outputCalloutRegex = /> \[!OUTPUT\]\+ {#output-[\w]+}\n(?:>.*\n)*>/gm;
  return content.replace(outputCalloutRegex, '');
}

/**
   * Saves the prepared note to a Quarto `.qmd` file within `exports/baseName/fileName`.
   * Creates the necessary directories if they do not exist.
   * @param content - The content to write to the file.
   * @param originalFilePath - The original file path of the note.
   * @returns The path to the exported file.
   */
async savePreparedNote(content: string, originalFilePath: string): Promise<string> {
  // Extract the base name without the '.md' extension
  const baseName = path.basename(originalFilePath, '.md');
  
  // Sanitize the base name to ensure it's a valid folder name
  const sanitizedBaseName = this.sanitizeFileName(baseName);
  
  // Define the Quarto file name
  const fileName = `${sanitizedBaseName}_quarto.qmd`; // Use .qmd extension for Quarto

  // Determine the base path of the vault
  let basePath: string;
  const adapter = this.app.vault.adapter;

  if (adapter instanceof FileSystemAdapter) {
    basePath = adapter.getBasePath();
  } else {
    new Notice('Unable to determine vault base path. Export failed.');
    throw new Error('Vault adapter is not a FileSystemAdapter.');
  }

  // Define the path to the 'exports' folder
  const exportsFolderPath = path.join(basePath, 'exports');

  // Define the path to the subfolder within 'exports' named after the base name
  const baseExportFolderPath = path.join(exportsFolderPath, sanitizedBaseName);

  // Ensure the 'exports' folder exists
  if (!fs.existsSync(exportsFolderPath)) {
    try {
      fs.mkdirSync(exportsFolderPath);
      console.log(`Created exports folder at ${exportsFolderPath}`);
    } catch (error) {
      new Notice('Failed to create exports folder. Export failed.');
      console.error('Error creating exports folder:', error);
      throw error;
    }
  }

  // Ensure the 'exports/baseName' folder exists
  if (!fs.existsSync(baseExportFolderPath)) {
    try {
      fs.mkdirSync(baseExportFolderPath);
      console.log(`Created base export folder at ${baseExportFolderPath}`);
    } catch (error) {
      new Notice('Failed to create base export folder. Export failed.');
      console.error('Error creating base export folder:', error);
      throw error;
    }
  }

  // Define the full path to the export file
  const exportFilePath = path.join(baseExportFolderPath, fileName);

  // Write the content to the export file
  try {
    await fs.promises.writeFile(exportFilePath, content, 'utf8');
    new Notice(`Exported to ${exportFilePath}`);
    console.log(`Successfully exported to ${exportFilePath}`);
  } catch (error) {
    new Notice('Failed to write export file. Export failed.');
    console.error('Error writing export file:', error);
    throw error;
  }

  return exportFilePath;
}


async renderWithQuarto(exportFilePath: string) {
  return new Promise<void>((resolve, reject) => {
    const quartoExecutable = this.settings.quartoExecutablePath || 'quarto';

    // Check if the Quarto executable exists
    if (!fs.existsSync(quartoExecutable)) {
      new Notice(`Quarto executable not found at ${quartoExecutable}. Please update the path in settings.`);
      console.error(`Quarto executable not found at ${quartoExecutable}.`);
      reject(new Error(`Quarto executable not found at ${quartoExecutable}.`));
      return;
    }

    // Get R executable path from settings
    const rExecutablePath = this.settings.rExecutablePath || 'Rscript';

    // Set up environment variables
    const env = { ...process.env };
    env.QUARTO_R = rExecutablePath;

    // Optional: Ensure Rscript is in PATH
    const rscriptDir = path.dirname(rExecutablePath);
    env.PATH = `${rscriptDir}${path.delimiter}${env.PATH}`;

    // Spawn the Quarto render process with the updated environment
    const renderProcess = spawn(
      quartoExecutable,
      ['render', exportFilePath],
      { stdio: ['ignore', 'pipe', 'pipe'], env: env }
    );

    let stderrData = ''; // Variable to accumulate stderr output

    // Capture stderr output
    renderProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    renderProcess.on('error', (err) => {
      new Notice('Failed to start Quarto rendering process.');
      console.error(`Failed to start Quarto rendering process: ${err}`);
      reject(err);
    });

    renderProcess.on('exit', (code, signal) => {
      console.log(`Quarto render process exited with code: ${code}, signal: ${signal}`);
      if (code === 0) {
        new Notice('Quarto rendering completed successfully.');
        resolve();
      } else {
        // Quarto exited with an error, present stderr output
        console.error(`Quarto stderr: ${stderrData}`);
        new Notice('Quarto rendering failed. Click for details.', 10000);
        reject(new Error(`Quarto exited with code ${code}`));
      }
    });
  });
}

// export note with quarto
async exportNoteWithQuarto() {
  const activeFile = this.app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice('No active note to export.');
    return;
  }

  try {
    const originalContent = await this.app.vault.read(activeFile);
    let content = originalContent;

    // Add front matter
    content = this.addFrontMatter(content, activeFile);

    // Strip output callouts
    content = this.stripOutputCallouts(content);

    // Replace code fence markers
   content = this.replaceCodeFenceMarkers(content);


    // Save the prepared note
    const exportFilePath = await this.savePreparedNote(content, activeFile.path);

    // Optionally, render with Quarto
    await this.renderWithQuarto(exportFilePath);

    // Open the rendered file or provide further instructions
    new Notice('Note exported and rendered with Quarto successfully.');

  } catch (err) {
    console.error('Failed to export note with Quarto:', err);
    new Notice('Failed to export note with Quarto.');
  }
}

  // ... (Include any additional methods from both plugins)
}
