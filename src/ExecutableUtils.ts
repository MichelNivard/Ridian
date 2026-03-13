import { Platform } from 'obsidian';
import * as fs from 'fs';
import * as path from 'path';

const which: {
  sync: (command: string, options?: { nothrow?: boolean }) => string | null;
} = require('which');

export interface ExecutableResolution {
  configuredPath: string;
  resolvedPath: string | null;
  source: 'configured' | 'path' | 'fallback' | null;
}

export function normalizeExecutableInput(value: string): string {
  return value.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

export function resolveRExecutable(configuredPath: string): ExecutableResolution {
  return resolveExecutable(configuredPath, rExecutableCandidates());
}

export function resolveQuartoExecutable(configuredPath: string): ExecutableResolution {
  return resolveExecutable(configuredPath, genericExecutableCandidates('quarto'));
}

export function resolvePandocExecutable(configuredPath: string): ExecutableResolution {
  const resolution = resolveExecutable(configuredPath, genericExecutableCandidates('pandoc'));
  if (resolution.resolvedPath) {
    return resolution;
  }

  return resolveExecutable(configuredPath, {
    names: executableNames('pandoc'),
    fallbacks: rStudioPandocFallbacks(),
  });
}

export function describeExecutableResolution(
  label: string,
  resolution: ExecutableResolution
): string {
  if (resolution.resolvedPath) {
    return `${label} resolved to ${resolution.resolvedPath} (${resolution.source}).`;
  }

  return `${label} could not be resolved. Leave it blank for auto-detection or point it to the executable file itself.`;
}

interface ExecutableCandidates {
  names: string[];
  fallbacks: string[];
}

function resolveExecutable(
  configuredPath: string,
  candidates: ExecutableCandidates
): ExecutableResolution {
  const normalizedConfiguredPath = normalizeExecutableInput(configuredPath);

  if (normalizedConfiguredPath) {
    const configuredResolution = resolveConfiguredPath(normalizedConfiguredPath, candidates.names);
    if (configuredResolution) {
      return {
        configuredPath: normalizedConfiguredPath,
        resolvedPath: configuredResolution,
        source: 'configured',
      };
    }
  }

  for (const executableName of candidates.names) {
    const fromPath = which.sync(executableName, { nothrow: true });
    if (typeof fromPath === 'string' && fromPath.length > 0) {
      return {
        configuredPath: normalizedConfiguredPath,
        resolvedPath: fromPath,
        source: 'path',
      };
    }
  }

  for (const fallbackPath of candidates.fallbacks) {
    if (isExecutableFile(fallbackPath)) {
      return {
        configuredPath: normalizedConfiguredPath,
        resolvedPath: fallbackPath,
        source: 'fallback',
      };
    }
  }

  return {
    configuredPath: normalizedConfiguredPath,
    resolvedPath: null,
    source: null,
  };
}

function resolveConfiguredPath(configuredPath: string, executableNames: string[]): string | null {
  if (!fs.existsSync(configuredPath)) {
    return null;
  }

  const stats = fs.statSync(configuredPath);
  if (stats.isFile()) {
    return configuredPath;
  }

  if (!stats.isDirectory()) {
    return null;
  }

  for (const executableName of executableNames) {
    const directCandidate = path.join(configuredPath, executableName);
    if (isExecutableFile(directCandidate)) {
      return directCandidate;
    }
  }

  if (executableNames.some((name) => name.toLowerCase().startsWith('r'))) {
    const x64Candidates = executableNames.map((name) => path.join(configuredPath, 'x64', name));
    for (const candidate of x64Candidates) {
      if (isExecutableFile(candidate)) {
        return candidate;
      }
    }
  }

  return null;
}

function isExecutableFile(candidatePath: string): boolean {
  try {
    return fs.existsSync(candidatePath) && fs.statSync(candidatePath).isFile();
  } catch (error) {
    return false;
  }
}

function executableNames(baseName: string): string[] {
  if (Platform.isWin) {
    return [`${baseName}.exe`, baseName];
  }

  return [baseName];
}

function genericExecutableCandidates(baseName: string): ExecutableCandidates {
  return {
    names: executableNames(baseName),
    fallbacks: genericFallbacks(baseName),
  };
}

function genericFallbacks(baseName: string): string[] {
  const names = executableNames(baseName);

  if (Platform.isWin) {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const localAppData = process.env.LocalAppData || '';

    const fallbackRoots = [
      path.join(programFiles, capitalize(baseName), 'bin'),
      path.join(programFiles, baseName, 'bin'),
      path.join(localAppData, 'Programs', capitalize(baseName), 'bin'),
    ];

    return fallbackRoots.flatMap((root) => names.map((name) => path.join(root, name)));
  }

  const unixFallbacks = ['/usr/local/bin', '/opt/homebrew/bin', '/usr/bin', '/bin'];
  return unixFallbacks.flatMap((root) => names.map((name) => path.join(root, name)));
}

function rExecutableCandidates(): ExecutableCandidates {
  const names = executableNames('R');

  if (Platform.isWin) {
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
    const candidateRoots = [programFiles, programFilesX86];
    const fallbacks: string[] = [];

    for (const root of candidateRoots) {
      const rRoot = path.join(root, 'R');
      if (!fs.existsSync(rRoot)) {
        continue;
      }

      for (const version of safeReadDir(rRoot).sort().reverse()) {
        const basePath = path.join(rRoot, version, 'bin');
        fallbacks.push(path.join(basePath, 'x64', 'R.exe'));
        fallbacks.push(path.join(basePath, 'R.exe'));
      }
    }

    return { names, fallbacks };
  }

  return {
    names,
    fallbacks: ['/usr/local/bin/R', '/opt/homebrew/bin/R', '/usr/bin/R', '/bin/R'],
  };
}

function rStudioPandocFallbacks(): string[] {
  if (Platform.isWin) {
    const localAppData = process.env.LocalAppData || '';
    return [
      path.join(localAppData, 'Programs', 'RStudio', 'resources', 'app', 'bin', 'quarto', 'bin', 'tools', 'pandoc.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'RStudio', 'resources', 'app', 'bin', 'quarto', 'bin', 'tools', 'pandoc.exe'),
      path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Pandoc', 'pandoc.exe'),
    ];
  }

  if (Platform.isMacOS) {
    return [
      '/Applications/RStudio.app/Contents/Resources/app/quarto/bin/tools/pandoc',
      '/usr/local/bin/pandoc',
      '/opt/homebrew/bin/pandoc',
    ];
  }

  return [
    '/usr/lib/rstudio/resources/app/quarto/bin/tools/pandoc',
    '/usr/local/bin/pandoc',
    '/usr/bin/pandoc',
  ];
}

function safeReadDir(directoryPath: string): string[] {
  try {
    return fs.readdirSync(directoryPath);
  } catch (error) {
    return [];
  }
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
