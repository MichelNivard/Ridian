// src/PathUtils.ts
import { Platform } from "obsidian";
import { execSync } from 'child_process';
import * as process from 'process';
import * as fs from 'fs';
import * as path from 'path';

export function setupPathEnvironment() {
  process.env.PATH = getUserShellPath();

  if (Platform.isMacOS) {
    process.env.PATH += ':/usr/local/bin:/opt/homebrew/bin';
  } else if (Platform.isLinux) {
    process.env.PATH += ':/usr/local/bin';
  } else if (Platform.isWin) {
    // Windows-specific PATH setup
    const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
    const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';

    let rPaths: string[] = [];

    function findRPaths(baseDir: string) {
      try {
        const rDir = path.join(baseDir, 'R');
        if (fs.existsSync(rDir)) {
          let versions = fs.readdirSync(rDir);
          versions = versions.filter((version) => /^R-\d+\.\d+\.\d+$/.test(version));

          versions.sort((a, b) => {
            const versionA = a.match(/R-(\d+\.\d+\.\d+)/)?.[1];
            const versionB = b.match(/R-(\d+\.\d+\.\d+)/)?.[1];
            if (versionA && versionB) {
              return compareVersions(versionB, versionA);
            } else {
              return 0;
            }
          });

          versions.forEach((version) => {
            const binPath = path.join(rDir, version, 'bin');
            if (fs.existsSync(binPath)) {
              rPaths.push(binPath);
            }
          });
        }
      } catch (error) {
        console.error(`Error accessing ${baseDir}:`, error);
      }
    }

    function compareVersions(v1: string, v2: string): number {
      const v1Parts = v1.split('.').map(Number);
      const v2Parts = v2.split('.').map(Number);
      for (let i = 0; i < v1Parts.length; i++) {
        if (v1Parts[i] > v2Parts[i]) return 1;
        if (v1Parts[i] < v2Parts[i]) return -1;
      }
      return 0;
    }

    findRPaths(programFiles);
    findRPaths(programFilesX86);

    rPaths.forEach((rPath) => {
      process.env.PATH = `${rPath};${process.env.PATH}`;
    });
  }
}


function getUserShellPath(): string {
  if (Platform.isWin) {
    // On Windows, use process.env.PATH directly
    return process.env.PATH || '';
  } else {
    try {
      // On macOS/Linux, execute 'echo $PATH' using the user's default shell
      const userShell = process.env.SHELL || '/bin/bash';
      const userPath = execSync('echo $PATH', { shell: userShell }).toString().trim();
      return userPath;
    } catch (error) {
      console.error("Could not retrieve PATH from user's shell:", error);
      // Fallback to process.env.PATH
      return process.env.PATH || '';
    }
  }
}
