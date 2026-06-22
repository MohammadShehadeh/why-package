import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { PackageJson, ProjectContext } from '../types';
import { detectLockfile } from './lockfile';

/** Error thrown when no project (package.json) can be located. */
export class ProjectNotFoundError extends Error {
  constructor(start: string) {
    super(`No package.json found in "${start}" or any parent directory.`);
    this.name = 'ProjectNotFoundError';
  }
}

export function readPackageJson(file: string): PackageJson {
  return JSON.parse(readFileSync(file, 'utf8')) as PackageJson;
}

/** Walk up from `start` until a directory containing package.json is found. */
export function findProjectRoot(start: string): string | null {
  let dir = path.resolve(start);
  while (true) {
    if (existsSync(path.join(dir, 'package.json'))) return dir;
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/** Resolve everything we need to know about the project being analyzed. */
export function loadProjectContext(start: string): ProjectContext {
  const root = findProjectRoot(start);
  if (!root) throw new ProjectNotFoundError(start);

  const packageJson = readPackageJson(path.join(root, 'package.json'));
  const detected = detectLockfile(root);

  return {
    root,
    packageJson,
    manager: detected?.manager ?? null,
    lockfilePath: detected?.path ?? null,
  };
}

/** Names of every declared dependency (prod + dev + optional + peer). */
export function declaredDependencyNames(pkg: PackageJson): Set<string> {
  return new Set([
    ...Object.keys(pkg.dependencies ?? {}),
    ...Object.keys(pkg.devDependencies ?? {}),
    ...Object.keys(pkg.optionalDependencies ?? {}),
    ...Object.keys(pkg.peerDependencies ?? {}),
  ]);
}

/** Which dependency bucket a package is declared in, if any. */
export function dependencyType(
  pkg: PackageJson,
  name: string,
): 'dependencies' | 'devDependencies' | 'optionalDependencies' | 'peerDependencies' | null {
  if (pkg.dependencies?.[name]) return 'dependencies';
  if (pkg.devDependencies?.[name]) return 'devDependencies';
  if (pkg.optionalDependencies?.[name]) return 'optionalDependencies';
  if (pkg.peerDependencies?.[name]) return 'peerDependencies';
  return null;
}
