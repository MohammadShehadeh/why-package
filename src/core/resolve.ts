import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import type { PackageJson } from '../types';

/**
 * Locate an installed package's directory by walking node_modules upward from
 * the project root (mirrors Node's resolution for hoisted dependencies).
 */
export function resolvePackageDir(root: string, name: string): string | null {
  let dir = path.resolve(root);
  const segments = name.split('/');
  while (true) {
    const candidate = path.join(dir, 'node_modules', ...segments);
    if (existsSync(path.join(candidate, 'package.json'))) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export interface InstalledPackage {
  dir: string;
  manifest: PackageJson;
}

/** Read an installed package's directory and parsed package.json. */
export function readInstalledManifest(root: string, name: string): InstalledPackage | null {
  const dir = resolvePackageDir(root, name);
  if (!dir) return null;
  try {
    const manifest = JSON.parse(
      readFileSync(path.join(dir, 'package.json'), 'utf8'),
    ) as PackageJson;
    return { dir, manifest };
  } catch {
    return null;
  }
}

/**
 * Total on-disk size of a package's own files (in bytes), excluding nested
 * node_modules so transitive deps aren't double-counted.
 */
export function directorySize(dir: string): number {
  let total = 0;
  const stack: string[] = [dir];
  while (stack.length > 0) {
    const current = stack.pop() as string;
    let entries;
    try {
      entries = readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        stack.push(full);
      } else if (entry.isFile()) {
        try {
          total += statSync(full).size;
        } catch {
          // Ignore unreadable files.
        }
      }
    }
  }
  return total;
}
