// src/RCodeEvaluator.ts

import { Editor, MarkdownView, Notice, TFile, Platform } from 'obsidian';
import CombinedPlugin from './CombinedPlugin';
import { createHash } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import { mkdtemp } from 'fs/promises';
import { REnvironmentView, VIEW_TYPE_R_ENVIRONMENT } from './REnvironmentView';
import { RHelpView, VIEW_TYPE_R_HELP } from './RHelpView';
const mkdtempAsync = promisify(fs.mkdtemp);

export async function runCurrentCodeChunk(plugin: CombinedPlugin, editor: Editor, view: MarkdownView, noteTitle: string) {
  const cursor = editor.getCursor();
  const { startLine, endLine: originalEndLine, code, existingLabel, options } = getCurrentCodeChunk(editor, cursor.line);

  let endLine = originalEndLine;

  if (code) {
    const uniqueId = existingLabel || generateUniqueId(startLine);
    const notePath = view.file?.path;
    if (notePath) {
      if (!existingLabel) {
        const linesInserted = insertLabel(editor, startLine, uniqueId);
        endLine += linesInserted;
      }

      try {
        const { result, imagePaths, widgetPaths, helpContent } = await runRCodeInSession(
          plugin,
          notePath,
          code,
          noteTitle,
          uniqueId,
          isHelpRequest(code),
          options
        );

        if (isHelpRequest(code)) {
          new Notice('Help content updated in the sidebar.');
        } else {
          const includeOption = options['include'] == 'false';
          const outputOption = options['output'] == 'false';

          if (result || imagePaths.length > 0 || widgetPaths.length > 0) {
            insertOutputWithCallout(editor, endLine, result, imagePaths, widgetPaths, uniqueId, options);
          }

          if (outputOption || includeOption) {
            removeOutputCallout(editor, uniqueId);
          }
        }
      } catch (err) {
        console.error('Error executing R code:', err);
        if (options['error'] !== 'false' && options['include'] !== 'false' && options['output'] !== 'false') {
          insertOutputWithCallout(editor, endLine, `Error:\n${err}`, [], [], uniqueId, options);
        } else {
          removeOutputCallout(editor, uniqueId);
        }
      }
    } else {
      new Notice('No file associated with the current view.');
    }
  } else {
    new Notice('No R code chunk found at the cursor position.');
  }
}

export function getCurrentCodeChunk(
  editor: Editor,
  cursorLine: number
): {
  startLine: number;
  endLine: number;
  code: string;
  codeWithAll: string;
  existingLabel: string | null;
  options: { [key: string]: string };
} {
  const totalLines = editor.lineCount();
  let startLine = cursorLine;
  let endLine = cursorLine;
  let existingLabel: string | null = null;
  let options: { [key: string]: string } = {};

  while (startLine >= 0 && !isCodeChunkStart(editor.getLine(startLine))) {
    startLine--;
  }

  if (startLine < 0) {
    return { startLine: -1, endLine: -1, code: '',codeWithAll: '', existingLabel: null, options: {} };
  }

  endLine = startLine + 1;
  while (endLine < totalLines && !editor.getLine(endLine).startsWith('```')) {
    endLine++;
  }

  if (endLine >= totalLines) {
    return { startLine: -1, endLine: -1, code: '',codeWithAll:'', existingLabel: null, options: {} };
  }

  existingLabel = parseChunkLabel(editor, startLine);
  options = parseChunkOptions(editor, startLine);

  const codeLines = [];
  const codeLinesWithAll = [];
  for (let i = startLine + 1; i < endLine; i++) {
    const line = editor.getLine(i);
    codeLinesWithAll.push(line);
    if (!line.trim().startsWith('#|')) {
      codeLines.push(line);
    }
  }
  const code = codeLines.join('\n');
  const codeWithAll = codeLinesWithAll.join('\n');

  return { startLine, endLine, code, codeWithAll, existingLabel, options };
}

function isCodeChunkStart(line: string): boolean {
  line = line.trim();
  return /^```{?r/.test(line);
}

function parseChunkOptions(editor: Editor, startLine: number): { [key: string]: string } {
  const options: { [key: string]: string } = {};
  let lineIndex = startLine + 1;
  const totalLines = editor.lineCount();

  while (lineIndex < totalLines) {
    const line = editor.getLine(lineIndex).trim();
    if (line.startsWith('#|')) {
      const optionMatch = line.match(/^#\|\s*(\w+)\s*:\s*(.*)$/);
      if (optionMatch) {
        const key = optionMatch[1];
        let value = optionMatch[2];
        value = value.replace(/^["']|["']$/g, '');
        options[key] = value;
      }
      lineIndex++;
    } else if (line === '' || line.startsWith('#')) {
      lineIndex++;
    } else {
      break;
    }
  }

  return options;
}

function parseChunkLabel(editor: Editor, startLine: number): string | null {
  let lineIndex = startLine + 1;
  const totalLines = editor.lineCount();

  while (lineIndex < totalLines) {
    const line = editor.getLine(lineIndex).trim();
    if (line.startsWith('#|')) {
      const optionMatch = line.match(/^#\|\s*(\w+)\s*:\s*(.*)$/);
      if (optionMatch) {
        const key = optionMatch[1];
        let value = optionMatch[2];
        value = value.replace(/^["']|["']$/g, '');
        if (key === 'label') {
          return value;
        }
      }
      lineIndex++;
    } else if (line === '' || line.startsWith('#')) {
      lineIndex++;
    } else {
      break;
    }
  }

  return null;
}

function insertLabel(editor: Editor, startLine: number, uniqueId: string): number {
  let insertPosition = startLine + 1;
  const totalLines = editor.lineCount();

  while (insertPosition < totalLines) {
    const line = editor.getLine(insertPosition).trim();
    if (line.startsWith('#|')) {
      insertPosition++;
    } else {
      break;
    }
  }

  editor.replaceRange(`#| label: ${uniqueId}\n`, { line: insertPosition, ch: 0 });
  return 1;
}

function generateUniqueId(position: number): string {
  return createHash('sha256').update(position.toString()).digest('hex').substring(0, 8);
}

function isHelpRequest(code: string): boolean {
  return /\?\s*\w+/.test(code) || /help\s*\(\s*\w+\s*\)/.test(code);
}

async function runRCodeInSession(
  plugin: CombinedPlugin,
  notePath: string,
  code: string,
  noteTitle: string,
  uniqueId: string,
  isHelpRequest: boolean,
  options: { [key: string]: string }
): Promise<{ result: string; imagePaths: string[]; widgetPaths: string[]; helpContent: string }> {
  const rProcess = getRProcess(plugin, notePath);

  return new Promise(async (resolve, reject) => {
    let output = '';
    let errorOutput = '';

    const tempDir = await mkdtempAsync(path.join(Platform.isWin ? 'C:\\Windows\\Temp\\' : '/tmp/', 'rplots-'));
    const tempDirEscaped = Platform.isWin ? tempDir.replace(/\\/g, '\\\\') : tempDir.replace(/\\/g, '/');

    
        const tempHelpFilePath = path.join(tempDir, `help_${uniqueId}.html`);
// Use forward slashes in the R path, regardless of the platform
        const tempHelpFilePathR = tempHelpFilePath.replace(/\\/g, '/');


    const marker = `__END_OF_OUTPUT__${Date.now()}__`;
    const imageMarker = `__PLOT_PATH__`;
    const envMarker = `__ENVIRONMENT_DATA__${Date.now()}__`;
    const widgetMarker = `__WIDGET_PATH__`;

    const optsCode = `
    opts <- list(
      echo = ${options['echo'] !== 'false' ? 'TRUE' : 'FALSE'},
      warning = ${options['warning'] !== 'false' ? 'TRUE' : 'FALSE'},
      error = ${options['error'] !== 'false' ? 'TRUE' : 'FALSE'},
      include = ${options['include'] !== 'false' ? 'TRUE' : 'FALSE'},
      output = ${options['output'] !== 'false' ? 'TRUE' : 'FALSE'}
    )
    `;

    const wrappedCode = `
library(evaluate)
library(jsonlite)
library(htmlwidgets)
Sys.setenv(RSTUDIO_PANDOC='${plugin.settings.rstudioPandocPath}')

${optsCode}

custom_print_htmlwidget <- function(x, ..., viewer = NULL) {
    widgetFileName <- paste0("widget_${uniqueId}_",".html")
    widgetFilePath <- file.path("${tempDirEscaped}", widgetFileName)
    saveWidget(x, widgetFilePath, selfcontained = TRUE)
    cat("${widgetMarker}", widgetFileName, "\\n", sep="")
}

environment(custom_print_htmlwidget) <- asNamespace('htmlwidgets')
assignInNamespace("print.htmlwidget", custom_print_htmlwidget, envir = as.environment("package:htmlwidgets"))

timecheck <- Sys.time()

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

if (!exists("user_env")) {
  user_env <- new.env()
}

results <- evaluate(${JSON.stringify(code)}, envir = user_env)

outputs <- character()
imagePaths <- character()

for (res in results) {
  if (inherits(res, "source")) {
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

if (opts$output && opts$include && length(outputs) > 0) {
  cat(paste(outputs, collapse = "\\n"), "\\n")
}

if (opts$output && opts$include) {
  for (img in imagePaths) {
    cat("${imageMarker}", img, "\\n", sep="")
  }
}

vars <- ls(envir = user_env)
env_list <- lapply(vars, function(var_name) {
  var_value <- get(var_name, envir = user_env)
  var_class <- class(var_value)
  var_size <- as.numeric(object.size(var_value))
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

    const onData = async (data: Buffer) => {
      const chunk = data.toString();
      output += chunk;

      if (output.includes(marker)) {
        rProcess.stdout.off('data', onData);
        rProcess.stderr.off('data', onErrorData);

        let result = '';
        let helpContent = '';

        if (isHelpRequest) {
          try {



            // Check if the help file exists
            if (fs.existsSync(tempHelpFilePath)) {
              const helpDataRaw = await fs.promises.readFile(tempHelpFilePath, 'utf8');
              helpContent = helpDataRaw;
            } else {
              console.error('Help file does not exist:', tempHelpFilePath);
              helpContent = 'Failed to retrieve help content.';
            }
          } catch (e) {
            console.error('Error reading help content:', e);
            helpContent = 'Failed to retrieve help content.';
          }
        
          const helpView = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_R_HELP)[0]?.view as RHelpView;
          if (helpView) {
            helpView.updateHelpContent(helpContent);
          }
        }

        let environmentData = '';
        if (output.includes(envMarker)) {
          const parts = output.split(envMarker);
          result = parts[0].trim();
          const envDataRaw = parts[1].split(marker)[0].trim();
          environmentData = envDataRaw;
        } else {
          result = output.split(marker)[0].trim();
        }

        const escapedImageMarker = imageMarker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const imagePaths: string[] = [];
        const imageRegex = new RegExp(`${escapedImageMarker}(.*)`, 'g');
        let match;
        while ((match = imageRegex.exec(result)) !== null) {
          if (match[1]) {
            const imageFileName = match[1].trim();
            imagePaths.push(imageFileName);
          }
        }

        result = result.replace(new RegExp(`${escapedImageMarker}.*`, 'g'), '').trim();

        for (const imageFileName of imagePaths) {
          const tempImagePath = path.join(tempDir, imageFileName);
          try {
            const imageData = await fs.promises.readFile(tempImagePath);
            const vaultImagePath = `plots/${imageFileName}`;
            const plotsFolder = plugin.app.vault.getAbstractFileByPath('plots');
            if (!plotsFolder) {
              await plugin.app.vault.createFolder('plots');
            }
            const existingFile = plugin.app.vault.getAbstractFileByPath(vaultImagePath);
            if (!existingFile) {
              await plugin.app.vault.createBinary(vaultImagePath, imageData);
            } else {
              await plugin.app.vault.modifyBinary(existingFile as TFile, imageData);
            }
            imagePaths[imagePaths.indexOf(imageFileName)] = vaultImagePath;
          } catch (err) {
            console.error(`Error handling image file ${imageFileName}:`, err);
          }
        }

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

        result = result.replace(new RegExp(`${escapedWidgetMarker}.*`, 'g'), '').trim();

        for (const widgetFileName of widgetPaths) {
          const tempWidgetPath = path.join(tempDir, widgetFileName);
          try {
            const widgetData = await fs.promises.readFile(tempWidgetPath, 'utf8');
            const vaultRelativeWidgetPath = `widgets/${widgetFileName}`;

            const vaultBasePath = (plugin.app.vault.adapter as any).getBasePath();

            const widgetsFolder = plugin.app.vault.getAbstractFileByPath('widgets');
            if (!widgetsFolder) {
              await plugin.app.vault.createFolder('widgets');
            }

            const existingWidgetFile = plugin.app.vault.getAbstractFileByPath(vaultRelativeWidgetPath);
            if (!existingWidgetFile) {
              await plugin.app.vault.create(vaultRelativeWidgetPath, widgetData);
            } else {
              await plugin.app.vault.modify(existingWidgetFile as TFile, widgetData);
            }

            const vaultWidgetPath = path.join(vaultBasePath, vaultRelativeWidgetPath);

            const widgetFileUrl = 'file://' + vaultWidgetPath;

            widgetPaths[widgetPaths.indexOf(widgetFileName)] = widgetFileUrl;
          } catch (err) {
            console.error(`Error handling widget file ${widgetFileName}:`, err);
          }
        }

        try {
          // await fs.promises.rm(tempDir, { recursive: true, force: true });
        } catch (err) {
          console.error(`Error removing temporary directory ${tempDir}:`, err);
        }

        const envView = plugin.app.workspace.getLeavesOfType(VIEW_TYPE_R_ENVIRONMENT)[0]?.view as REnvironmentView;
        if (envView) {
          let envVariables: any[] = [];
          try {
            envVariables = JSON.parse(environmentData);
          } catch (e) {
            console.error('Failed to parse environment data JSON:', e);
          }
          envView.updateEnvironmentData(noteTitle, envVariables);
        }

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
      errorOutput += chunk;
    };

    rProcess.stdout.on('data', onData);
    rProcess.stderr.on('data', onErrorData);

    rProcess.stdin.write(wrappedCode + '\n');
  });
}

function getRProcess(plugin: CombinedPlugin, notePath: string): ChildProcessWithoutNullStreams {
  let rProcess = plugin.rProcesses.get(notePath);
  if (!rProcess) {
    rProcess = startRProcess(plugin, notePath);
  }
  return rProcess;
}

function startRProcess(plugin: CombinedPlugin, notePath: string): ChildProcessWithoutNullStreams {
  const rExecutable = plugin.settings.rExecutablePath.trim() || '/usr/local/bin/R';
  if (!rExecutable) {
    new Notice('R executable path is not set. Please update the path in settings.');
    throw new Error('R executable path is not set.');
  }

  if (!fs.existsSync(rExecutable)) {
    new Notice(`R executable not found at ${rExecutable}. Please update the path in settings.`);
    throw new Error(`R executable not found at ${rExecutable}.`);
  }

  const env = { ...process.env };

  const rProcess = spawn(rExecutable, ['--vanilla', '--quiet', '--slave'], { stdio: 'pipe', env });

  rProcess.on('error', (err) => {
    console.error(`Failed to start R process for ${notePath}:`, err);
  });

  const initCode = `
library(jsonlite)
if (!exists("user_env")) {
  user_env <- new.env()
}
options(browser='false')
options(bitmapType = 'cairo')
options(device = function(...) jpeg(filename = tempfile(), width=800, height=600, ...))
  `;
  rProcess.stdin.write(initCode + '\n');

  plugin.rProcesses.set(notePath, rProcess);

  return rProcess;
}


function escapeMarkdown(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-!>|])/g, '\\$1');
}

function insertOutputWithCallout(
  editor: Editor,
  endLine: number,
  output: string,
  imagePaths: string[],
  widgetPaths: string[],
  uniqueId: string,
  options: { [key: string]: string },
  isError: boolean = false // Optional parameter to style errors differently
) {
  const contentLines: string[] = [];

  if (output && output.trim() !== '') {
    // Escape markdown special characters in the output
    const escapedOutput = escapeMarkdown(output.trim());
    const outputLines = escapedOutput.split('\n').map((line) => '> ' + line);
    contentLines.push(...outputLines);
  }

  imagePaths.forEach((imagePath) => {
    const vaultImagePath = `${imagePath}`;
    const imageMarkdown = `![center|480](${vaultImagePath})`;
    contentLines.push(`> ${imageMarkdown}`);
  });

  widgetPaths.forEach((widgetPath) => {
    const widgetMarkdown = `<iframe src="${widgetPath}" width="100%" height="680px"></iframe>`;
    contentLines.push(`> ${widgetMarkdown}`);
  });

  if (contentLines.length === 0) {
    return;
  }

  // Use a different callout type or add a class for errors if needed
  let calloutType = isError ? 'ERROR' : 'OUTPUT';
  let outputContent = `> [!${calloutType}]+ {#output-${uniqueId}}\n`;
  outputContent += contentLines.join('\n') + '\n';
  outputContent += '> \n';

  let existingOutputStart = -1;
  let existingOutputEnd = -1;
  const totalLines = editor.lineCount();

  for (let i = 0; i < totalLines; i++) {
    const line = editor.getLine(i);
    if (line.trim() === `> [!${calloutType}]+ {#output-${uniqueId}}`) {
      existingOutputStart = i;
      existingOutputEnd = i;
      while (existingOutputEnd + 1 < totalLines) {
        const nextLine = editor.getLine(existingOutputEnd + 1);
        if (!nextLine.startsWith('> ') && nextLine.trim() !== '') {
          break;
        }
        existingOutputEnd++;
      }
      break;
    }
  }

  if (existingOutputStart !== -1 && existingOutputEnd !== -1) {
    const from = { line: existingOutputStart, ch: 0 };
    const to = { line: existingOutputEnd + 1, ch: 0 };
    editor.replaceRange(outputContent + '\n', from, to);
  } else {
    const insertPosition = { line: endLine + 1, ch: 0 };
    editor.replaceRange('\n' + outputContent + '\n', insertPosition);
  }
}


function removeOutputCallout(editor: Editor, uniqueId: string) {
    let existingOutputStart = -1;
    let existingOutputEnd = -1;
    const totalLines = editor.lineCount();
  
    for (let i = 0; i < totalLines; i++) {
      const line = editor.getLine(i);
      if (line.trim() === `> [!OUTPUT]+ {#output-${uniqueId}}`) {
        existingOutputStart = i;
        existingOutputEnd = i;
        while (existingOutputEnd + 1 < totalLines) {
          const nextLine = editor.getLine(existingOutputEnd + 1);
          if (!nextLine.startsWith('> ') && nextLine.trim() !== '') {
            break;
          }
          existingOutputEnd++;
        }
        break;
      }
    }
  
    if (existingOutputStart !== -1 && existingOutputEnd !== -1) {
      const from = { line: existingOutputStart, ch: 0 };
      const to = { line: existingOutputEnd + 1, ch: 0 };
      editor.replaceRange('', from, to);
    }
  }