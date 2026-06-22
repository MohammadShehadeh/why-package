import { existsSync } from 'node:fs';
import path from 'node:path';
import { Project, type SourceFile, ts } from 'ts-morph';
import type { PackageExports, PackageJson } from '../types';
import { readInstalledManifest } from './resolve';

/**
 * Best-effort detection of a package's named exports, used to surface "unused
 * exports". Prefers TypeScript declarations, then an ESM entry point. Returns
 * `{ all: null }` when exports can't be determined (e.g. CJS-only, no types).
 */
export function detectPackageExports(root: string, name: string): PackageExports {
  const installed = readInstalledManifest(root, name);
  if (!installed) return { all: null, source: 'unknown' };

  const typeEntry = findTypesEntry(installed.dir, installed.manifest);
  if (typeEntry) {
    const names = parseExports(typeEntry);
    if (names && names.length > 0) return { all: names, source: 'types' };
  }

  const esmEntry = findEsmEntry(installed.dir, installed.manifest);
  if (esmEntry) {
    const names = parseExports(esmEntry);
    if (names && names.length > 0) return { all: names, source: 'esm' };
  }

  return { all: null, source: 'unknown' };
}

function parseExports(filePath: string): string[] | null {
  if (!existsSync(filePath)) return null;
  const project = new Project({
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      allowJs: true,
      skipLibCheck: true,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      target: ts.ScriptTarget.ESNext,
    },
  });

  let sourceFile: SourceFile;
  try {
    sourceFile = project.addSourceFileAtPath(filePath);
  } catch {
    return null;
  }

  try {
    const names = new Set<string>();
    for (const [name] of sourceFile.getExportedDeclarations()) {
      if (name !== 'default') names.add(name);
    }
    if (names.size > 0) return [...names].sort();
    return shallowExports(sourceFile);
  } catch {
    try {
      return shallowExports(sourceFile);
    } catch {
      return null;
    }
  }
}

/** Fallback that reads only the entry file, without following re-exports. */
function shallowExports(sourceFile: SourceFile): string[] {
  const names = new Set<string>();

  for (const decl of sourceFile.getExportDeclarations()) {
    for (const named of decl.getNamedExports()) names.add(named.getName());
  }
  for (const fn of sourceFile.getFunctions()) {
    const name = fn.getName();
    if (name && fn.isExported()) names.add(name);
  }
  for (const cls of sourceFile.getClasses()) {
    const name = cls.getName();
    if (name && cls.isExported()) names.add(name);
  }
  for (const variable of sourceFile.getVariableDeclarations()) {
    if (variable.getVariableStatement()?.isExported()) names.add(variable.getName());
  }
  for (const iface of sourceFile.getInterfaces()) {
    if (iface.isExported()) names.add(iface.getName());
  }
  for (const alias of sourceFile.getTypeAliases()) {
    if (alias.isExported()) names.add(alias.getName());
  }
  for (const enumDecl of sourceFile.getEnums()) {
    if (enumDecl.isExported()) names.add(enumDecl.getName());
  }

  names.delete('default');
  return [...names].sort();
}

function resolveMaybe(dir: string, target: unknown): string | null {
  if (typeof target !== 'string') return null;
  const full = path.join(dir, target);
  return existsSync(full) ? full : null;
}

function findTypesEntry(dir: string, manifest: PackageJson): string | null {
  const fromExports = pickFromExports(manifest.exports, dir, ['types', 'typings']);
  if (fromExports) return fromExports;

  const declared = resolveMaybe(dir, manifest.types ?? manifest.typings);
  if (declared) return declared;

  const indexDts = path.join(dir, 'index.d.ts');
  if (existsSync(indexDts)) return indexDts;

  if (typeof manifest.main === 'string') {
    const sibling = path.join(dir, manifest.main.replace(/\.(c|m)?js$/, '.d.ts'));
    if (existsSync(sibling)) return sibling;
  }
  return null;
}

function findEsmEntry(dir: string, manifest: PackageJson): string | null {
  const fromExports = pickFromExports(manifest.exports, dir, ['import', 'module', 'default']);
  if (fromExports) return fromExports;

  const moduleEntry = resolveMaybe(dir, manifest.module);
  if (moduleEntry) return moduleEntry;

  if (manifest.type === 'module') {
    const mainEntry = resolveMaybe(dir, manifest.main);
    if (mainEntry) return mainEntry;
    const indexJs = path.join(dir, 'index.js');
    if (existsSync(indexJs)) return indexJs;
  }

  const indexMjs = path.join(dir, 'index.mjs');
  return existsSync(indexMjs) ? indexMjs : null;
}

/** Walk a package.json `exports` map looking for the first matching condition. */
function pickFromExports(exportsField: unknown, dir: string, keys: string[]): string | null {
  if (!exportsField || typeof exportsField !== 'object') return null;
  const record = exportsField as Record<string, unknown>;
  const root = record['.'] ?? record;
  return pickCondition(root, dir, keys);
}

function pickCondition(node: unknown, dir: string, keys: string[]): string | null {
  if (!node || typeof node !== 'object') return null;
  const record = node as Record<string, unknown>;

  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') {
      const resolved = resolveMaybe(dir, value);
      if (resolved) return resolved;
    } else if (value && typeof value === 'object') {
      const nested = pickCondition(value, dir, keys);
      if (nested) return nested;
    }
  }

  // Descend through common nested conditions.
  for (const key of ['node', 'default', 'import', 'require']) {
    const value = record[key];
    if (value && typeof value === 'object') {
      const nested = pickCondition(value, dir, keys);
      if (nested) return nested;
    }
  }
  return null;
}
