// src/ExportHandler.ts

import { TFile, Notice, FileSystemAdapter } from 'obsidian';
import CombinedPlugin from './CombinedPlugin';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export async function exportNoteWithQuarto(plugin: CombinedPlugin) {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice('No active note to export.');
    return;
  }

  try {
    const originalContent = await plugin.app.vault.read(activeFile);
    let content = originalContent;

    content = addFrontMatter(content, activeFile);
    content = stripOutputCallouts(content);
    content = replaceCodeFenceMarkers(content);

    const exportFilePath = await savePreparedNote(plugin, content, activeFile.path);
    await renderWithQuarto(plugin, exportFilePath);

    new Notice('Note exported and rendered with Quarto successfully.');
  } catch (err) {
    console.error('Failed to export note with Quarto:', err);
    new Notice('Failed to export note with Quarto.');
  }
}

function addFrontMatter(content: string, activeFile: TFile): string {
  if (content.startsWith('---\n')) {
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

function stripOutputCallouts(content: string): string {
  const outputCalloutRegex = /> \[!OUTPUT\]\+ {#output-[\w]+}\n(?:>.*\n)*>/gm;
  return content.replace(outputCalloutRegex, '');
}

function replaceCodeFenceMarkers(content: string): string {
  const codeFenceRegex = /^```r$/gim;
  return content.replace(codeFenceRegex, '```{r}');
}

async function savePreparedNote(plugin: CombinedPlugin, content: string, originalFilePath: string): Promise<string> {
  const baseName = path.basename(originalFilePath, '.md');
  const sanitizedBaseName = sanitizeFileName(baseName);
  const fileName = `${sanitizedBaseName}_quarto.qmd`;

  let basePath: string;
  const adapter = plugin.app.vault.adapter;
  
  if (adapter instanceof FileSystemAdapter) {
    basePath = adapter.getBasePath();
  } else {
    new Notice('Unable to determine vault base path. Export failed.');
    throw new Error('Vault adapter is not a FileSystemAdapter.');
  }

  const exportsFolderPath = path.join(basePath, 'exports');
  const baseExportFolderPath = path.join(exportsFolderPath, sanitizedBaseName);

  if (!fs.existsSync(exportsFolderPath)) {
    try {
      fs.mkdirSync(exportsFolderPath);
    } catch (error) {
      new Notice('Failed to create exports folder. Export failed.');
      throw error;
    }
  }

  if (!fs.existsSync(baseExportFolderPath)) {
    try {
      fs.mkdirSync(baseExportFolderPath);
    } catch (error) {
      new Notice('Failed to create base export folder. Export failed.');
      throw error;
    }
  }

  const exportFilePath = path.join(baseExportFolderPath, fileName);

  try {
    await fs.promises.writeFile(exportFilePath, content, 'utf8');
    new Notice(`Exported to ${exportFilePath}`);
  } catch (error) {
    new Notice('Failed to write export file. Export failed.');
    throw error;
  }

  return exportFilePath;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9-_]/g, '_');
}

async function renderWithQuarto(plugin: CombinedPlugin, exportFilePath: string) {
  return new Promise<void>((resolve, reject) => {
    const quartoExecutable = plugin.settings.quartoExecutablePath || 'quarto';

    if (!fs.existsSync(quartoExecutable)) {
      new Notice(`Quarto executable not found at ${quartoExecutable}. Please update the path in settings.`);
      reject(new Error(`Quarto executable not found at ${quartoExecutable}.`));
      return;
    }

    const rExecutablePath = plugin.settings.rExecutablePath || 'Rscript';

    const env = { ...process.env };
    env.QUARTO_R = rExecutablePath;

    const rscriptDir = path.dirname(rExecutablePath);
    env.PATH = `${rscriptDir}${path.delimiter}${env.PATH}`;

    const renderProcess = spawn(quartoExecutable, ['render', exportFilePath], { stdio: ['ignore', 'pipe', 'pipe'], env: env });

    let stderrData = '';

    renderProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    renderProcess.on('error', (err) => {
      new Notice('Failed to start Quarto rendering process.');
      reject(err);
    });

    renderProcess.on('exit', (code, signal) => {
      if (code === 0) {
        new Notice('Quarto rendering completed successfully.');
        resolve();
      } else {
        console.error(`Quarto stderr: ${stderrData}`);
        new Notice('Quarto rendering failed. Click for details.', 10000);
        reject(new Error(`Quarto exited with code ${code}`));
      }
    });
  });
}
