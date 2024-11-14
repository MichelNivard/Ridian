// src/SettingsTab.ts

import { App, PluginSettingTab, Setting, Notice } from 'obsidian';
import CombinedPlugin from './CombinedPlugin';

export interface CombinedPluginSettings {
  rExecutablePath: string;
  rstudioPandocPath: string;
  quartoExecutablePath: string;
  enableFloatingMenu: boolean;
}

export const DEFAULT_SETTINGS: CombinedPluginSettings = {
  rExecutablePath: '',
  rstudioPandocPath: '',
  quartoExecutablePath: '',
  enableFloatingMenu: true,
};

export class MyPluginSettingTab extends PluginSettingTab {
  plugin: CombinedPlugin;

  constructor(app: App, plugin: CombinedPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'R Integration Settings' });

    new Setting(containerEl)
      .setName('Path to R Executable')
      .setDesc('Specify the path to your R executable.')
      .addText((text) =>
        text
          .setPlaceholder('Enter path to R executable')
          .setValue(this.plugin.settings.rExecutablePath)
          .onChange(async (value) => {
            this.plugin.settings.rExecutablePath = value.trim();
            await this.plugin.saveSettings();
            new Notice('R executable path updated successfully.');
          })
      );

    new Setting(containerEl)
      .setName('Path to RStudio Pandoc')
      .setDesc('Specify the path to your RStudio Pandoc installation.')
      .addText((text) =>
        text
          .setPlaceholder('Enter path to RStudio Pandoc')
          .setValue(this.plugin.settings.rstudioPandocPath)
          .onChange(async (value) => {
            this.plugin.settings.rstudioPandocPath = value.trim();
            await this.plugin.saveSettings();
            new Notice('RStudio Pandoc path updated successfully.');
          })
      );

    new Setting(containerEl)
      .setName('Quarto Executable Path')
      .setDesc('Specify the path to your Quarto executable.')
      .addText((text) =>
        text
          .setPlaceholder('Enter path to Quarto executable')
          .setValue(this.plugin.settings.quartoExecutablePath)
          .onChange(async (value) => {
            this.plugin.settings.quartoExecutablePath = value.trim();
            await this.plugin.saveSettings();
            new Notice('Quarto executable path updated successfully.');
          })
      );

    new Setting(containerEl)
      .setName('Enable Floating Menu')
      .setDesc('Toggle to show or hide the floating menu in the editor.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableFloatingMenu).onChange(async (value) => {
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
