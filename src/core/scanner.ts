import { readFile, stat } from 'node:fs/promises';
import fg from 'fast-glob';
import { DEFAULT_IGNORE_DIRS, SOURCE_EXTENSIONS } from '../constants';
import { mapWithConcurrency } from '../utils/concurrency';
import type { FileImports, ScanResult } from '../types';
import type { ScanCache } from './cache';
import { extractImports } from './imports';

export interface ScanOptions {
  /** Absolute project root to scan. */
  root: string;
  /** Optional persistent cache; pass null to disable. */
  cache?: ScanCache | null;
  /** Extra ignore globs (in addition to the built-in defaults). */
  ignore?: string[];
  /** Max concurrent file reads. */
  concurrency?: number;
}

/**
 * Scan a project's first-party source files and extract their imports.
 * Heavy directories (node_modules, build output, etc.) are ignored, and
 * unchanged files are served from the cache when one is supplied.
 */
export async function scanProject(options: ScanOptions): Promise<ScanResult> {
  const { root, cache = null, ignore = [], concurrency = 24 } = options;
  const startedAt = Date.now();

  const pattern = `**/*.{${SOURCE_EXTENSIONS.map((ext) => ext.slice(1)).join(',')}}`;
  const ignoreGlobs = [...DEFAULT_IGNORE_DIRS.map((dir) => `**/${dir}/**`), ...ignore];

  const files = await fg(pattern, {
    cwd: root,
    absolute: true,
    ignore: ignoreGlobs,
    followSymbolicLinks: false,
    suppressErrors: true,
    dot: false,
  });

  let cached = 0;
  const results = await mapWithConcurrency<string, FileImports>(
    files,
    concurrency,
    async (file) => {
      let mtimeMs = 0;
      let size = 0;
      try {
        const info = await stat(file);
        mtimeMs = info.mtimeMs;
        size = info.size;
      } catch {
        return { file, imports: [] };
      }

      const hit = cache?.get(file, mtimeMs, size);
      if (hit) {
        cached += 1;
        return { file, imports: hit };
      }

      let imports: FileImports['imports'];
      try {
        const content = await readFile(file, 'utf8');
        imports = extractImports(file, content);
      } catch {
        imports = [];
      }
      cache?.set(file, mtimeMs, size, imports);
      return { file, imports };
    },
  );

  cache?.save();

  return {
    files: results,
    scanned: files.length,
    cached,
    durationMs: Date.now() - startedAt,
  };
}
