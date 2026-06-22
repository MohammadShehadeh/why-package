import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { LOCKFILES } from '../../constants';
import type { NormalizedLock, PackageJson, PackageManager } from '../../types';
import { parseNpmLock } from './npm';
import { parsePnpmLock } from './pnpm';
import { parseYarnLock } from './yarn';

/** Detection order when more than one lockfile is present. */
const PRIORITY: PackageManager[] = ['pnpm', 'yarn', 'npm'];

export interface DetectedLockfile {
  manager: PackageManager;
  path: string;
}

/** Find the lockfile in a project root, if any. */
export function detectLockfile(root: string): DetectedLockfile | null {
  for (const manager of PRIORITY) {
    const file = path.join(root, LOCKFILES[manager]);
    if (existsSync(file)) return { manager, path: file };
  }
  return null;
}

/** Read and normalize the project's lockfile into a uniform graph. */
export function loadNormalizedLock(root: string, packageJson: PackageJson): NormalizedLock | null {
  const detected = detectLockfile(root);
  if (!detected) return null;

  const content = readFileSync(detected.path, 'utf8');
  if (detected.manager === 'npm') return parseNpmLock(content, detected.path, packageJson);
  if (detected.manager === 'pnpm') return parsePnpmLock(content, detected.path);
  return parseYarnLock(content, detected.path, packageJson);
}

export { parseNpmLock, parsePnpmLock, parseYarnLock };
