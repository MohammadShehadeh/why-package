import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { CACHE_DIR, CACHE_VERSION } from '../constants';
import type { ImportRef } from '../types';

interface CacheEntry {
  /** mtime in ms (floored). */
  m: number;
  /** file size in bytes. */
  s: number;
  /** extracted imports. */
  i: ImportRef[];
}

interface CacheFile {
  version: number;
  entries: Record<string, CacheEntry>;
}

/**
 * Persistent, mtime-based cache of per-file import analysis. Lets repeat runs
 * skip re-parsing unchanged files — the key to staying fast on large repos.
 *
 * All disk access is best-effort: a missing or corrupt cache, or an
 * unwritable directory (e.g. no node_modules), degrades to "no cache" rather
 * than failing the command.
 */
export class ScanCache {
  private dirty = false;

  private constructor(
    private readonly file: string,
    private readonly entries: Map<string, CacheEntry>,
  ) {}

  static load(root: string): ScanCache {
    const file = path.join(root, CACHE_DIR, `scan-v${CACHE_VERSION}.json`);
    const entries = new Map<string, CacheEntry>();
    try {
      if (existsSync(file)) {
        const data = JSON.parse(readFileSync(file, 'utf8')) as CacheFile;
        if (data.version === CACHE_VERSION && data.entries) {
          for (const [key, value] of Object.entries(data.entries)) {
            entries.set(key, value);
          }
        }
      }
    } catch {
      // Corrupt or unreadable cache — start fresh.
    }
    return new ScanCache(file, entries);
  }

  get(file: string, mtimeMs: number, size: number): ImportRef[] | null {
    const entry = this.entries.get(file);
    if (entry && entry.m === Math.floor(mtimeMs) && entry.s === size) {
      return entry.i;
    }
    return null;
  }

  set(file: string, mtimeMs: number, size: number, imports: ImportRef[]): void {
    this.entries.set(file, { m: Math.floor(mtimeMs), s: size, i: imports });
    this.dirty = true;
  }

  save(): void {
    if (!this.dirty) return;
    try {
      mkdirSync(path.dirname(this.file), { recursive: true });
      const data: CacheFile = {
        version: CACHE_VERSION,
        entries: Object.fromEntries(this.entries),
      };
      writeFileSync(this.file, JSON.stringify(data));
      this.dirty = false;
    } catch {
      // Caching is best-effort; ignore write failures.
    }
  }
}
