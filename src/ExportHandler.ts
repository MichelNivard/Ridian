import { FileSystemAdapter, Notice, TFile } from 'obsidian';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import CombinedPlugin from './CombinedPlugin';

export async function exportNoteWithQuarto(plugin: CombinedPlugin) {
  const activeFile = plugin.app.workspace.getActiveFile();
  if (!activeFile) {
    new Notice('No active note to export.');
    return;
  }

  try {
    const originalContent = await plugin.app.vault.read(activeFile);
    let content = addFrontMatter(originalContent, activeFile);
    content = stripOutputCallouts(content);
    content = replaceCodeFenceMarkers(content);

    const { content: convertedContent, imagePaths } = convertImageLinks(content);
    const exportFilePath = await savePreparedNote(plugin, convertedContent, activeFile.path);
    await copyImageFiles(plugin, activeFile, imagePaths, path.dirname(exportFilePath));
    await renderWithQuarto(plugin, exportFilePath);

    new Notice('Note exported and rendered with Quarto successfully.');
  } catch (error) {
    console.error('Failed to export note with Quarto:', error);
    new Notice(
      error instanceof Error ? `Failed to export note with Quarto: ${error.message}` : 'Failed to export note with Quarto.'
    );
  }
}

function addFrontMatter(content: string, activeFile: TFile): string {
  if (content.startsWith('---\n')) {
    return content;
  }

  return `---
title: "${activeFile.basename}"
author: "Author Name"
date: today
format: html
---\n\n${content}`;
}

function stripOutputCallouts(content: string): string {
  const outputCalloutRegex = /> \[!(?:OUTPUT|ERROR)\]\+ {#output-[\w-]+}\n(?:>.*\n)*/gm;
  return content.replace(outputCalloutRegex, '');
}

function replaceCodeFenceMarkers(content: string): string {
  return content.replace(/^```r$/gim, '```{r}');
}

async function savePreparedNote(
  plugin: CombinedPlugin,
  content: string,
  originalFilePath: string
): Promise<string> {
  const baseName = path.basename(originalFilePath, '.md');
  const sanitizedBaseName = sanitizeFileName(baseName);
  const fileName = `${sanitizedBaseName}_quarto.qmd`;
  const adapter = plugin.app.vault.adapter;

  if (!(adapter instanceof FileSystemAdapter)) {
    throw new Error('Vault adapter is not a FileSystemAdapter.');
  }

  const basePath = adapter.getBasePath();
  const exportsFolderPath = path.join(basePath, 'exports');
  const baseExportFolderPath = path.join(exportsFolderPath, sanitizedBaseName);
  await fs.promises.mkdir(baseExportFolderPath, { recursive: true });

  const exportFilePath = path.join(baseExportFolderPath, fileName);
  await fs.promises.writeFile(exportFilePath, content, 'utf8');
  new Notice(`Exported to ${exportFilePath}`);
  return exportFilePath;
}

function sanitizeFileName(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9-_]/g, '_');
}

async function renderWithQuarto(plugin: CombinedPlugin, exportFilePath: string) {
  return new Promise<void>((resolve, reject) => {
    const quartoExecutable = plugin.getResolvedQuartoExecutablePath();
    if (!quartoExecutable) {
      reject(
        new Error(
          'Quarto executable could not be resolved. Leave the setting blank for auto-detection or point it to the executable file.'
        )
      );
      return;
    }

    const rExecutablePath = plugin.getResolvedRExecutablePath();
    if (!rExecutablePath) {
      reject(
        new Error(
          'R executable could not be resolved. Leave the setting blank for auto-detection or point it to the executable file.'
        )
      );
      return;
    }

    const environment = { ...process.env };
    environment.QUARTO_R = rExecutablePath;
    environment.PATH = `${path.dirname(rExecutablePath)}${path.delimiter}${environment.PATH || ''}`;

    const renderProcess = spawn(quartoExecutable, ['render', exportFilePath], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: environment,
    });

    let stdoutData = '';
    let stderrData = '';

    renderProcess.stdout.on('data', (data) => {
      stdoutData += data.toString();
    });

    renderProcess.stderr.on('data', (data) => {
      stderrData += data.toString();
    });

    renderProcess.on('error', (error) => {
      reject(error);
    });

    renderProcess.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          [stderrData.trim(), stdoutData.trim(), `Quarto exited with code ${code}.`]
            .filter(Boolean)
            .join('\n')
        )
      );
    });
  });
}

function convertImageLinks(content: string): { content: string; imagePaths: Set<string> } {
  const imageLinkRegex = /!\[\[([^\]]+)\]\]/g;
  const imagePaths = new Set<string>();

  const newContent = content.replace(imageLinkRegex, (_match, inner) => {
    const [imagePath, altText] = inner.split('|');
    const cleanedPath = imagePath.trim();
    imagePaths.add(cleanedPath);
    const imageFileName = path.basename(cleanedPath);
    return `![${altText ? altText.trim() : imageFileName}](${imageFileName})`;
  });

  return { content: newContent, imagePaths };
}

async function copyImageFiles(
  plugin: CombinedPlugin,
  sourceFile: TFile,
  imagePaths: Set<string>,
  exportFolderPath: string
) {
  const adapter = plugin.app.vault.adapter;
  if (!(adapter instanceof FileSystemAdapter)) {
    throw new Error('Vault adapter is not a FileSystemAdapter.');
  }

  const basePath = adapter.getBasePath();

  for (const imagePath of imagePaths) {
    const resolvedImage = plugin.app.metadataCache.getFirstLinkpathDest(imagePath, sourceFile.path);
    const sourcePath = resolvedImage
      ? path.join(basePath, resolvedImage.path)
      : path.join(basePath, imagePath);
    const destinationPath = path.join(exportFolderPath, path.basename(imagePath));

    try {
      await fs.promises.copyFile(sourcePath, destinationPath);
    } catch (error) {
      console.error(`Failed to copy image ${imagePath} to ${destinationPath}:`, error);
      new Notice(`Failed to copy image ${imagePath}.`);
    }
  }
}
