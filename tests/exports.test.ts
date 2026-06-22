import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { detectPackageExports } from '../src/core/exports';

let root: string;

function addPackage(name: string, files: Record<string, string>): void {
  const dir = path.join(root, 'node_modules', name);
  mkdirSync(dir, { recursive: true });
  for (const [file, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, file), content);
  }
}

beforeAll(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'why-package-exports-'));

  addPackage('typed-pkg', {
    'package.json': JSON.stringify({ name: 'typed-pkg', version: '1.0.0', types: 'index.d.ts' }),
    'index.d.ts':
      'export declare const alpha: number;\n' +
      'export declare function beta(): string;\n' +
      'export default function gamma(): void;\n',
  });

  addPackage('esm-pkg', {
    'package.json': JSON.stringify({
      name: 'esm-pkg',
      version: '1.0.0',
      type: 'module',
      main: 'index.js',
    }),
    'index.js': 'export const one = 1;\nexport function two() {}\n',
  });
});

afterAll(() => rmSync(root, { recursive: true, force: true }));

describe('detectPackageExports', () => {
  it('reads named exports from TypeScript declarations (default excluded)', () => {
    const result = detectPackageExports(root, 'typed-pkg');
    expect(result.source).toBe('types');
    expect(result.all).toEqual(['alpha', 'beta']);
  });

  it('reads named exports from an ESM entry point', () => {
    const result = detectPackageExports(root, 'esm-pkg');
    expect(result.source).toBe('esm');
    expect(result.all).toEqual(['one', 'two']);
  });

  it('returns null when the package is not installed', () => {
    expect(detectPackageExports(root, 'missing-pkg').all).toBeNull();
  });
});
