import { Editor, MarkdownView, Notice, TFile } from 'obsidian';
import { createHash, randomUUID } from 'crypto';
import { spawn, ChildProcessWithoutNullStreams } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StringDecoder } from 'string_decoder';
import CombinedPlugin from './CombinedPlugin';
import { resolvePandocExecutable } from './ExecutableUtils';

const EXECUTION_TIMEOUT_MS = 60_000;
const SESSION_IDLE_TIMEOUT_MS = 5 * 60_000;

export interface EnvironmentVariable {
  name: string;
  type: string | string[];
  size: number;
  value: string[] | string;
}

interface ExecutionPayload {
  output?: string;
  imagePaths?: string[];
  widgetPaths?: string[];
  environment?: EnvironmentVariable[];
  helpPath?: string | null;
  error?: string | null;
}

export interface NoteRSession {
  notePath: string;
  process: ChildProcessWithoutNullStreams;
  queue: Promise<void>;
  idleTimer: ReturnType<typeof setTimeout> | null;
}

export async function runCurrentCodeChunk(
  plugin: CombinedPlugin,
  editor: Editor,
  view: MarkdownView,
  noteTitle: string
) {
  const cursor = editor.getCursor();
  const {
    startLine,
    endLine: originalEndLine,
    code,
    existingLabel,
    options,
  } = getCurrentCodeChunk(editor, cursor.line);

  if (!code) {
    new Notice('No R code chunk found at the cursor position.');
    return;
  }

  const notePath = view.file?.path;
  if (!notePath) {
    new Notice('No file associated with the current view.');
    return;
  }

  const uniqueId = existingLabel || generateUniqueId(startLine);
  let endLine = originalEndLine;

  if (!existingLabel) {
    endLine += insertLabel(editor, startLine, uniqueId);
  }

  try {
    const executionResult = await runRCodeInSession(
      plugin,
      notePath,
      code,
      noteTitle,
      uniqueId,
      options
    );

    if (isHelpRequest(code)) {
      new Notice('Help content updated in the sidebar.');
      return;
    }

    if (options['include'] === 'false' || options['output'] === 'false') {
      removeOutputCallout(editor, uniqueId);
      return;
    }

    if (
      executionResult.result ||
      executionResult.imagePaths.length > 0 ||
      executionResult.widgetPaths.length > 0
    ) {
      insertOutputWithCallout(
        editor,
        endLine,
        executionResult.result,
        executionResult.imagePaths,
        executionResult.widgetPaths,
        uniqueId
      );
    } else {
      removeOutputCallout(editor, uniqueId);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error executing R code:', error);

    if (
      options['error'] !== 'false' &&
      options['include'] !== 'false' &&
      options['output'] !== 'false'
    ) {
      insertOutputWithCallout(editor, endLine, message, [], [], uniqueId, true);
    } else {
      removeOutputCallout(editor, uniqueId);
    }
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
    return {
      startLine: -1,
      endLine: -1,
      code: '',
      codeWithAll: '',
      existingLabel: null,
      options: {},
    };
  }

  endLine = startLine + 1;
  while (endLine < totalLines && !editor.getLine(endLine).startsWith('```')) {
    endLine++;
  }

  if (endLine >= totalLines) {
    return {
      startLine: -1,
      endLine: -1,
      code: '',
      codeWithAll: '',
      existingLabel: null,
      options: {},
    };
  }

  existingLabel = parseChunkLabel(editor, startLine);
  options = parseChunkOptions(editor, startLine);

  const codeLines: string[] = [];
  const codeLinesWithAll: string[] = [];
  for (let lineIndex = startLine + 1; lineIndex < endLine; lineIndex++) {
    const line = editor.getLine(lineIndex);
    codeLinesWithAll.push(line);
    if (!line.trim().startsWith('#|')) {
      codeLines.push(line);
    }
  }

  return {
    startLine,
    endLine,
    code: codeLines.join('\n'),
    codeWithAll: codeLinesWithAll.join('\n'),
    existingLabel,
    options,
  };
}

export function stopAllRSessions(plugin: CombinedPlugin) {
  for (const notePath of plugin.rSessions.keys()) {
    destroyRSession(plugin, notePath);
  }
}

function isCodeChunkStart(line: string): boolean {
  return /^```{?r/.test(line.trim());
}

function parseChunkOptions(editor: Editor, startLine: number): { [key: string]: string } {
  const options: { [key: string]: string } = {};
  let lineIndex = startLine + 1;
  const totalLines = editor.lineCount();

  while (lineIndex < totalLines) {
    const line = editor.getLine(lineIndex).trim();
    if (line.startsWith('#|')) {
      const optionMatch = line.match(/^#\|\s*([\w-]+)\s*:\s*(.*)$/);
      if (optionMatch) {
        options[optionMatch[1]] = optionMatch[2].replace(/^["']|["']$/g, '');
      }
      lineIndex++;
      continue;
    }

    if (line === '' || line.startsWith('#')) {
      lineIndex++;
      continue;
    }

    break;
  }

  return options;
}

function parseChunkLabel(editor: Editor, startLine: number): string | null {
  return parseChunkOptions(editor, startLine).label || null;
}

function insertLabel(editor: Editor, startLine: number, uniqueId: string): number {
  let insertPosition = startLine + 1;
  const totalLines = editor.lineCount();

  while (insertPosition < totalLines) {
    const line = editor.getLine(insertPosition).trim();
    if (!line.startsWith('#|')) {
      break;
    }
    insertPosition++;
  }

  editor.replaceRange(`#| label: ${uniqueId}\n`, { line: insertPosition, ch: 0 });
  return 1;
}

function generateUniqueId(position: number): string {
  const suffix = createHash('sha256').update(position.toString()).digest('hex').substring(0, 8);
  return `ridian-${suffix}`;
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
  options: { [key: string]: string }
): Promise<{ result: string; imagePaths: string[]; widgetPaths: string[]; helpContent: string }> {
  const session = getOrCreateRSession(plugin, notePath);

  return enqueueOnSession(plugin, session, async () => {
    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ridian-'));
    const tempHelpPath = path.join(tempDir, `help_${uniqueId}.html`);
    const requestId = randomUUID();
    const startMarker = `__RIDIAN_RESULT_START__${requestId}__`;
    const endMarker = `__RIDIAN_RESULT_END__${requestId}__`;

    try {
      const pandocResolution = resolvePandocExecutable(plugin.settings.rstudioPandocPath);
      const payload = await executeRRequest(
        session.process,
        buildExecutionScript({
          code,
          uniqueId,
          options,
          tempDir,
          tempHelpPath,
          startMarker,
          endMarker,
          pandocPath: pandocResolution.resolvedPath,
        }),
        startMarker,
        endMarker
      );

      const imagePaths = await persistBinaryFiles(plugin, payload.imagePaths || [], tempDir, 'plots');
      const widgetPaths = await persistWidgetFiles(plugin, payload.widgetPaths || [], tempDir);
      const helpContent = await loadHelpContent(payload.helpPath || tempHelpPath);
      const environment = Array.isArray(payload.environment) ? payload.environment : [];

      plugin.publishEnvironmentData(notePath, noteTitle, environment);
      if (helpContent) {
        plugin.publishHelpContent(notePath, noteTitle, helpContent);
      }

      if (payload.error) {
        throw new Error(payload.error);
      }

      return {
        result: payload.output || '',
        imagePaths,
        widgetPaths,
        helpContent,
      };
    } finally {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    }
  });
}

function getOrCreateRSession(plugin: CombinedPlugin, notePath: string): NoteRSession {
  const existingSession = plugin.rSessions.get(notePath);
  if (existingSession) {
    return existingSession;
  }

  const rExecutable = plugin.getResolvedRExecutablePath();
  if (!rExecutable) {
    throw new Error(
      'R executable could not be resolved. Leave the setting blank for auto-detection or point it to the R executable file.'
    );
  }

  const processEnv = { ...process.env };
  const rProcess = spawn(rExecutable, ['--vanilla', '--quiet', '--slave'], {
    stdio: 'pipe',
    env: processEnv,
  });

  const session: NoteRSession = {
    notePath,
    process: rProcess,
    queue: Promise.resolve(),
    idleTimer: null,
  };

  rProcess.on('error', (error) => {
    console.error(`Failed to start R process for ${notePath}:`, error);
    destroyRSession(plugin, notePath);
  });

  rProcess.on('exit', (code, signal) => {
    if (code !== null || signal !== null) {
      console.warn(`R session for ${notePath} exited`, { code, signal });
    }
    destroyRSession(plugin, notePath);
  });

  rProcess.stdin.write(`${buildSessionBootstrap()}\n`);
  plugin.rSessions.set(notePath, session);
  return session;
}

function enqueueOnSession<T>(
  plugin: CombinedPlugin,
  session: NoteRSession,
  task: () => Promise<T>
): Promise<T> {
  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
    session.idleTimer = null;
  }

  const queuedTask = session.queue.then(task, task);
  session.queue = queuedTask.then(
    () => undefined,
    () => undefined
  );

  return queuedTask.finally(() => {
    session.idleTimer = setTimeout(() => {
      destroyRSession(plugin, session.notePath);
    }, SESSION_IDLE_TIMEOUT_MS);
  });
}

function destroyRSession(plugin: CombinedPlugin, notePath: string) {
  const session = plugin.rSessions.get(notePath);
  if (!session) {
    return;
  }

  if (session.idleTimer) {
    clearTimeout(session.idleTimer);
  }

  plugin.rSessions.delete(notePath);

  if (!session.process.killed) {
    session.process.kill();
  }
}

function buildSessionBootstrap(): string {
  return `
options(browser = "false")
options(encoding = "UTF-8")
try(Sys.setlocale("LC_ALL", "C"), silent = TRUE)
if (capabilities("cairo")) {
  options(bitmapType = "cairo")
}
if (!exists("user_env", inherits = FALSE)) {
  user_env <- new.env(parent = globalenv())
}
`;
}

function buildExecutionScript({
  code,
  uniqueId,
  options,
  tempDir,
  tempHelpPath,
  startMarker,
  endMarker,
  pandocPath,
}: {
  code: string;
  uniqueId: string;
  options: { [key: string]: string };
  tempDir: string;
  tempHelpPath: string;
  startMarker: string;
  endMarker: string;
  pandocPath: string | null;
}): string {
  const boolLiteral = (value: string | undefined, defaultValue: boolean) =>
    value === undefined ? defaultValue : value !== 'false';

  return `
local({
  start_marker <- ${toRString(startMarker)}
  end_marker <- ${toRString(endMarker)}
  unique_id <- ${toRString(uniqueId)}
  code_text <- ${toRString(code)}
  temp_dir <- ${toRString(toRPath(tempDir))}
  help_path <- ${toRString(toRPath(tempHelpPath))}
  pandoc_path <- ${toRString(pandocPath || '')}
  opts <- list(
    echo = ${boolLiteral(options.echo, true) ? 'TRUE' : 'FALSE'},
    warning = ${boolLiteral(options.warning, true) ? 'TRUE' : 'FALSE'},
    error = ${boolLiteral(options.error, true) ? 'TRUE' : 'FALSE'},
    include = ${boolLiteral(options.include, true) ? 'TRUE' : 'FALSE'},
    output = ${boolLiteral(options.output, true) ? 'TRUE' : 'FALSE'}
  )

  emit_json <- function(payload_json) {
    cat(start_marker, payload_json, end_marker, sep = "")
  }

  emit_error_payload <- function(message) {
    safe <- gsub("\\\\", "\\\\\\\\", message)
    safe <- gsub("\"", "\\\\\\"", safe)
    safe <- gsub("\\n", "\\\\n", safe)
    emit_json(paste0(
      '{"output":"","imagePaths":[],"widgetPaths":[],"environment":[],"helpPath":null,"error":"',
      safe,
      '"}'
    ))
  }

  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    emit_error_payload("Required R package 'jsonlite' is not installed.")
  } else if (!requireNamespace("evaluate", quietly = TRUE)) {
    emit_error_payload("Required R package 'evaluate' is not installed.")
  } else {
    payload <- list(
      output = "",
      imagePaths = character(),
      widgetPaths = character(),
      environment = list(),
      helpPath = NULL,
      error = NULL
    )

    tryCatch({
      suppressPackageStartupMessages({
        library(jsonlite)
        library(evaluate)
      })

      if (nzchar(pandoc_path)) {
        Sys.setenv(RSTUDIO_PANDOC = pandoc_path)
      }

      has_htmlwidgets <- requireNamespace("htmlwidgets", quietly = TRUE)
      if (has_htmlwidgets) {
        custom_print_htmlwidget <- function(x, ..., viewer = NULL) {
          widget_file_name <- paste0("widget_", unique_id, "_", format(Sys.time(), "%Y%m%d%H%M%S"), ".html")
          widget_file_path <- file.path(temp_dir, widget_file_name)
          htmlwidgets::saveWidget(x, widget_file_path, selfcontained = TRUE)
          payload$widgetPaths <- c(payload$widgetPaths, widget_file_name)
        }

        environment(custom_print_htmlwidget) <- asNamespace("htmlwidgets")
        assignInNamespace(
          "print.htmlwidget",
          custom_print_htmlwidget,
          envir = as.environment("package:htmlwidgets")
        )
      }

      timecheck <- Sys.time()

      .getHelpFile <- function(file) {
        help_meta_path <- dirname(file)
        package_root <- dirname(help_meta_path)
        if (!file.exists(package_root)) {
          stop(gettextf("invalid %s argument", sQuote("file")), domain = NA)
        }
        package_name <- basename(package_root)
        rd_db <- file.path(help_meta_path, package_name)
        if (!file.exists(paste(rd_db, "rdx", sep = "."))) {
          stop(
            gettextf(
              "package %s exists but was not installed under R >= 2.10.0 so help cannot be accessed",
              sQuote(package_name)
            ),
            domain = NA
          )
        }
        tools:::fetchRdDB(rd_db, basename(file))
      }

      print.help_files_with_topic <- function(x, ...) {
        topic <- attr(x, "topic")
        paths <- as.character(x)

        if (!length(paths)) {
          writeLines(c(
            gettextf("No documentation for %s in specified packages and libraries:", sQuote(topic)),
            gettextf("you could try %s", sQuote(paste0("??", topic)))
          ))
          return(invisible(x))
        }

        file <- paths[1L]
        package_name <- basename(dirname(dirname(file)))
        tools::Rd2HTML(.getHelpFile(file), out = help_path, package = package_name)
        payload$helpPath <- help_path
        invisible(x)
      }

      results <- evaluate::evaluate(code_text, envir = user_env)
      outputs <- character()
      image_paths <- character()

      for (res in results) {
        if (inherits(res, "source")) {
          next
        }

        if (inherits(res, "warning")) {
          if (opts$warning && opts$include) {
            outputs <- c(outputs, paste("Warning:", conditionMessage(res)))
          }
          next
        }

        if (inherits(res, "message")) {
          if (opts$output && opts$include) {
            outputs <- c(outputs, conditionMessage(res))
          }
          next
        }

        if (inherits(res, "error")) {
          if (opts$error && opts$include) {
            outputs <- c(outputs, paste("Error:", conditionMessage(res)))
          }
          next
        }

        if (inherits(res, "character")) {
          if (opts$output && opts$include) {
            outputs <- c(outputs, res)
          }
          next
        }

        if (inherits(res, "recordedplot")) {
          if (opts$output && opts$include) {
            timestamp <- format(Sys.time(), "%Y%m%d%H%M%S")
            plot_file_name <- paste0("plot_", unique_id, "_", length(image_paths) + 1, "_", timestamp, ".jpg")
            plot_file_path <- file.path(temp_dir, plot_file_name)
            grDevices::jpeg(filename = plot_file_path, width = 800, height = 600)
            replayPlot(res)
            grDevices::dev.off()
            image_paths <- c(image_paths, plot_file_name)
          }
        }
      }

      if (opts$output && opts$include && requireNamespace("gganimate", quietly = TRUE)) {
        anim <- try(gganimate::last_animation(), silent = TRUE)
        if (is.character(anim[1]) && file.exists(anim[1])) {
          if (file.info(anim[1])$mtime > timecheck) {
            timestamp <- format(Sys.time(), "%Y%m%d%H%M%S")
            animation_file_name <- paste0("animation_", unique_id, "_", timestamp, ".gif")
            animation_file_path <- file.path(temp_dir, animation_file_name)
            file.copy(anim[1], animation_file_path)
            image_paths <- c(image_paths, animation_file_name)
          }
        }
      }

      if (opts$output && opts$include && length(outputs) > 0) {
        payload$output <- paste(outputs, collapse = "\\n")
      }

      payload$imagePaths <- unname(image_paths)

      vars <- ls(envir = user_env)
      payload$environment <- lapply(vars, function(var_name) {
        var_value <- get(var_name, envir = user_env)
        list(
          name = var_name,
          type = class(var_value),
          size = as.numeric(object.size(var_value)),
          value = capture.output(str(var_value, max.level = 0))
        )
      })
    }, error = function(err) {
      payload$error <- conditionMessage(err)
    })

    emit_json(jsonlite::toJSON(payload, auto_unbox = TRUE, null = "null", force = TRUE))
  }
})
`;
}

function toRString(value: string): string {
  return JSON.stringify(value);
}

function toRPath(value: string): string {
  return value.replace(/\\/g, '/');
}

async function executeRRequest(
  rProcess: ChildProcessWithoutNullStreams,
  code: string,
  startMarker: string,
  endMarker: string
): Promise<ExecutionPayload> {
  return new Promise((resolve, reject) => {
    const stdoutDecoder = new StringDecoder('utf8');
    const stderrDecoder = new StringDecoder('utf8');
    let stdoutBuffer = '';
    let stderrBuffer = '';
    let settled = false;

    const cleanup = () => {
      clearTimeout(timeout);
      rProcess.stdout.off('data', onStdout);
      rProcess.stderr.off('data', onStderr);
      rProcess.off('error', onError);
      rProcess.off('exit', onExit);
    };

    const settle = (handler: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      handler();
    };

    const tryResolvePayload = () => {
      const payloadJson = extractBetween(stdoutBuffer, startMarker, endMarker);
      if (!payloadJson) {
        return;
      }

      settle(() => {
        try {
          resolve(JSON.parse(payloadJson) as ExecutionPayload);
        } catch (error) {
          reject(
            new Error(
              `Failed to parse R execution payload: ${
                error instanceof Error ? error.message : String(error)
              }`
            )
          );
        }
      });
    };

    const onStdout = (chunk: Buffer) => {
      stdoutBuffer += stdoutDecoder.write(chunk);
      tryResolvePayload();
    };

    const onStderr = (chunk: Buffer) => {
      stderrBuffer += stderrDecoder.write(chunk);
    };

    const onError = (error: Error) => {
      settle(() => {
        reject(error);
      });
    };

    const onExit = (code: number | null, signal: NodeJS.Signals | null) => {
      stdoutBuffer += stdoutDecoder.end();
      stderrBuffer += stderrDecoder.end();
      tryResolvePayload();

      settle(() => {
        const stderrSuffix = stderrBuffer.trim() ? ` ${stderrBuffer.trim()}` : '';
        reject(
          new Error(
            `R session exited before returning a result (code=${code}, signal=${signal}).${stderrSuffix}`
          )
        );
      });
    };

    const timeout = setTimeout(() => {
      settle(() => {
        reject(
          new Error(
            `R execution timed out after ${EXECUTION_TIMEOUT_MS / 1000}s.${
              stderrBuffer.trim() ? ` ${stderrBuffer.trim()}` : ''
            }`
          )
        );
      });
    }, EXECUTION_TIMEOUT_MS);

    rProcess.stdout.on('data', onStdout);
    rProcess.stderr.on('data', onStderr);
    rProcess.on('error', onError);
    rProcess.on('exit', onExit);

    rProcess.stdin.write(`${code}\n`, (error) => {
      if (error) {
        settle(() => {
          reject(error);
        });
      }
    });
  });
}

function extractBetween(buffer: string, startMarker: string, endMarker: string): string | null {
  const startIndex = buffer.indexOf(startMarker);
  if (startIndex === -1) {
    return null;
  }

  const endIndex = buffer.indexOf(endMarker, startIndex + startMarker.length);
  if (endIndex === -1) {
    return null;
  }

  return buffer.slice(startIndex + startMarker.length, endIndex);
}

async function persistBinaryFiles(
  plugin: CombinedPlugin,
  fileNames: string[],
  tempDir: string,
  vaultFolder: string
): Promise<string[]> {
  const resolvedPaths: string[] = [];
  await ensureVaultFolder(plugin, vaultFolder);

  for (const fileName of fileNames) {
    const sourcePath = path.join(tempDir, fileName);
    const data = await fs.promises.readFile(sourcePath);
    const vaultPath = `${vaultFolder}/${fileName}`;
    const targetFile = await upsertBinaryFile(plugin, vaultPath, data);
    resolvedPaths.push(targetFile.path);
  }

  return resolvedPaths;
}

async function persistWidgetFiles(
  plugin: CombinedPlugin,
  fileNames: string[],
  tempDir: string
): Promise<string[]> {
  const resolvedPaths: string[] = [];
  await ensureVaultFolder(plugin, 'widgets');

  for (const fileName of fileNames) {
    const sourcePath = path.join(tempDir, fileName);
    const data = await fs.promises.readFile(sourcePath, 'utf8');
    const vaultPath = `widgets/${fileName}`;
    const targetFile = await upsertTextFile(plugin, vaultPath, data);
    resolvedPaths.push(plugin.app.vault.getResourcePath(targetFile));
  }

  return resolvedPaths;
}

async function ensureVaultFolder(plugin: CombinedPlugin, folderPath: string) {
  if (plugin.app.vault.getAbstractFileByPath(folderPath)) {
    return;
  }

  await plugin.app.vault.createFolder(folderPath);
}

async function upsertBinaryFile(plugin: CombinedPlugin, vaultPath: string, data: ArrayBuffer) {
  const existingFile = plugin.app.vault.getAbstractFileByPath(vaultPath);
  if (existingFile instanceof TFile) {
    await plugin.app.vault.modifyBinary(existingFile, data);
    return existingFile;
  }

  return plugin.app.vault.createBinary(vaultPath, data);
}

async function upsertTextFile(plugin: CombinedPlugin, vaultPath: string, data: string) {
  const existingFile = plugin.app.vault.getAbstractFileByPath(vaultPath);
  if (existingFile instanceof TFile) {
    await plugin.app.vault.modify(existingFile, data);
    return existingFile;
  }

  return plugin.app.vault.create(vaultPath, data);
}

async function loadHelpContent(helpPath: string): Promise<string> {
  try {
    if (!helpPath || !fs.existsSync(helpPath)) {
      return '';
    }

    return await fs.promises.readFile(helpPath, 'utf8');
  } catch (error) {
    console.error('Failed to load help content:', error);
    return '';
  }
}

function insertOutputWithCallout(
  editor: Editor,
  endLine: number,
  output: string,
  imagePaths: string[],
  widgetPaths: string[],
  uniqueId: string,
  isError: boolean = false
) {
  const contentLines: string[] = [];
  const mediaLines: string[] = [];

  if (output.trim()) {
    contentLines.push(...output.trimEnd().split('\n').map((line) => `> ${line}`));
  }

  for (const imagePath of imagePaths) {
    mediaLines.push(`> ![center|480](${imagePath})`);
  }

  for (const widgetPath of widgetPaths) {
    mediaLines.push(`> <iframe src="${widgetPath}" width="100%" height="680px"></iframe>`);
  }

  if (contentLines.length === 0 && mediaLines.length === 0) {
    return;
  }

  const calloutType = isError ? 'ERROR' : 'OUTPUT';
  let outputContent = `> [!${calloutType}]+ {#output-${uniqueId}}\n`;

  if (contentLines.length > 0) {
    outputContent += '> ```text\n';
    outputContent += `${contentLines.join('\n')}\n`;
    outputContent += '> ```\n';
  }

  if (mediaLines.length > 0) {
    outputContent += `${mediaLines.join('\n')}\n`;
  }

  const existingOutput = findExistingOutputRange(editor, uniqueId);
  if (existingOutput) {
    editor.replaceRange(`${outputContent}\n`, existingOutput.from, existingOutput.to);
    return;
  }

  editor.replaceRange(`\n${outputContent}\n`, { line: endLine + 1, ch: 0 });
}

function removeOutputCallout(editor: Editor, uniqueId: string) {
  const existingOutput = findExistingOutputRange(editor, uniqueId);
  if (!existingOutput) {
    return;
  }

  editor.replaceRange('', existingOutput.from, existingOutput.to);
}

function findExistingOutputRange(
  editor: Editor,
  uniqueId: string
): { from: { line: number; ch: number }; to: { line: number; ch: number } } | null {
  const totalLines = editor.lineCount();

  for (let lineIndex = 0; lineIndex < totalLines; lineIndex++) {
    const line = editor.getLine(lineIndex).trim();
    if (
      (line.startsWith('> [!OUTPUT]+') || line.startsWith('> [!ERROR]+')) &&
      line.includes(`{#output-${uniqueId}}`)
    ) {
      let endLine = lineIndex;
      while (endLine + 1 < totalLines) {
        const nextLine = editor.getLine(endLine + 1);
        if (!nextLine.startsWith('> ') && nextLine.trim() !== '') {
          break;
        }
        endLine++;
      }

      return {
        from: { line: lineIndex, ch: 0 },
        to: { line: endLine + 1, ch: 0 },
      };
    }
  }

  return null;
}
