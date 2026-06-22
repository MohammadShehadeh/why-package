import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { BUNDLEPHOBIA_API, CACHE_DIR } from '../constants';
import type { BundleInfo } from '../types';

const CACHE_FILE = 'bundle.json';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface BundleOptions {
  /** Project root, used for the on-disk cache. */
  root?: string;
  noCache?: boolean;
}

/** Network timeout for the Bundlephobia lookup. */
const TIMEOUT_MS = 8000;

/**
 * Look up a package's bundle size from Bundlephobia, with a 7-day on-disk
 * cache. Always resolves — network or API failures return an "unavailable"
 * result so callers can degrade gracefully offline.
 */
export async function getBundleInfo(
  name: string,
  version: string | null,
  options: BundleOptions = {},
): Promise<BundleInfo> {
  const key = version ? `${name}@${version}` : name;

  if (options.root && !options.noCache) {
    const cached = readCache(options.root, key);
    if (cached) return cached;
  }

  const info = await fetchFromApi(name, version, TIMEOUT_MS);

  if (options.root && info.source === 'bundlephobia') {
    writeCache(options.root, key, info);
  }
  return info;
}

async function fetchFromApi(
  name: string,
  version: string | null,
  timeoutMs: number,
): Promise<BundleInfo> {
  const pkg = version ? `${name}@${version}` : name;
  const url = `${BUNDLEPHOBIA_API}?package=${encodeURIComponent(pkg)}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json', 'user-agent': 'why-package' },
    });
    if (!response.ok) return unavailable(name, version, `HTTP ${response.status}`);

    const data = (await response.json()) as {
      size?: number;
      gzip?: number;
      dependencyCount?: number;
    };
    return {
      name,
      version,
      gzip: numberOrNull(data.gzip),
      minified: numberOrNull(data.size),
      dependencyCount: numberOrNull(data.dependencyCount),
      source: 'bundlephobia',
    };
  } catch (error) {
    return unavailable(name, version, error instanceof Error ? error.message : 'network error');
  } finally {
    clearTimeout(timer);
  }
}

function unavailable(name: string, version: string | null, error: string): BundleInfo {
  return {
    name,
    version,
    gzip: null,
    minified: null,
    dependencyCount: null,
    source: 'unavailable',
    error,
  };
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

interface BundleCacheFile {
  entries: Record<string, { t: number; info: BundleInfo }>;
}

function cachePath(root: string): string {
  return path.join(root, CACHE_DIR, CACHE_FILE);
}

function readCache(root: string, key: string): BundleInfo | null {
  try {
    const file = cachePath(root);
    if (!existsSync(file)) return null;
    const data = JSON.parse(readFileSync(file, 'utf8')) as BundleCacheFile;
    const entry = data.entries?.[key];
    if (entry && Date.now() - entry.t < CACHE_TTL_MS) return entry.info;
  } catch {
    // Ignore unreadable cache.
  }
  return null;
}

function writeCache(root: string, key: string, info: BundleInfo): void {
  try {
    const file = cachePath(root);
    let data: BundleCacheFile = { entries: {} };
    if (existsSync(file)) {
      try {
        data = JSON.parse(readFileSync(file, 'utf8')) as BundleCacheFile;
        data.entries ??= {};
      } catch {
        data = { entries: {} };
      }
    }
    data.entries[key] = { t: Date.now(), info };
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(data));
  } catch {
    // Caching is best-effort.
  }
}
