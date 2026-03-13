// src/SettingsTab.ts

import { App, PluginSettingTab, Setting, TextComponent, Notice } from 'obsidian';
import CombinedPlugin from './CombinedPlugin';
import {
  describeExecutableResolution,
  ExecutableResolution,
  resolvePandocExecutable,
  resolveQuartoExecutable,
  resolveRExecutable,
} from './ExecutableUtils';

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

    const createExecutableSetting = (
      name: string,
      description: string,
      value: string,
      resolve: (configuredPath: string) => ExecutableResolution,
      onChange: (nextValue: string) => Promise<void>
    ) => {
      let textInput: TextComponent;

      new Setting(containerEl)
        .setName(name)
        .setDesc(description)
        .addText((text) => {
          textInput = text;
          text
            .setPlaceholder('Leave blank to auto-detect')
            .setValue(value)
            .onChange(async (nextValue) => {
              await onChange(nextValue.trim());
            });
        })
        .addButton((button) =>
          button.setButtonText('Auto-detect').onClick(async () => {
            const resolution = resolve('');
            if (!resolution.resolvedPath) {
              new Notice(`${name} could not be auto-detected.`);
              return;
            }

            textInput.setValue(resolution.resolvedPath);
            await onChange(resolution.resolvedPath);
            new Notice(describeExecutableResolution(name, resolve(resolution.resolvedPath)));
          })
        )
        .addButton((button) =>
          button.setButtonText('Validate').onClick(() => {
            new Notice(describeExecutableResolution(name, resolve(textInput.getValue())));
          })
        );
    };

    createExecutableSetting(
      'Path to R Executable',
      'Must point to the R executable itself. Leave blank to auto-detect from PATH or common install locations.',
      this.plugin.settings.rExecutablePath,
      resolveRExecutable,
      async (value) => {
        await this.plugin.updateRExecutablePath(value);
      }
    );

    createExecutableSetting(
      'Path to Pandoc',
      'Optional. Used for self-contained htmlwidgets. Leave blank to auto-detect Pandoc or the RStudio-bundled Pandoc.',
      this.plugin.settings.rstudioPandocPath,
      resolvePandocExecutable,
      async (value) => {
        await this.plugin.updatePandocPath(value);
      }
    );

    createExecutableSetting(
      'Quarto Executable Path',
      'Leave blank to auto-detect Quarto from PATH or common install locations.',
      this.plugin.settings.quartoExecutablePath,
      resolveQuartoExecutable,
      async (value) => {
        await this.plugin.updateQuartoExecutablePath(value);
      }
    );

    new Setting(containerEl)
      .setName('Enable Floating Menu')
      .setDesc('Toggle to show or hide the floating menu in the editor.')
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enableFloatingMenu).onChange(async (value) => {
          await this.plugin.setFloatingMenuEnabled(value);
        })
      );
  }
}
