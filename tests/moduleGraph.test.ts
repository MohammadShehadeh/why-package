import { describe, expect, it } from 'vitest';
import { buildImportedByTree, buildModuleGraph, resolveLocalImport } from '../src/core/moduleGraph';
import type { ScanResult } from '../src/types';

const importRef = (specifier: string) => ({
  specifier,
  packageName: null,
  named: [],
  hasDefault: false,
  hasNamespace: false,
  kind: 'import' as const,
});

describe('resolveLocalImport', () => {
  const fileSet = new Set(['/proj/src/b.ts', '/proj/src/c/index.ts', '/proj/src/d.ts']);

  it('resolves direct, index, and .js→.ts variants', () => {
    expect(resolveLocalImport('/proj/src/a.ts', './b', fileSet)).toBe('/proj/src/b.ts');
    expect(resolveLocalImport('/proj/src/a.ts', './c', fileSet)).toBe('/proj/src/c/index.ts');
    expect(resolveLocalImport('/proj/src/a.ts', './d.js', fileSet)).toBe('/proj/src/d.ts');
  });

  it('returns null when nothing matches', () => {
    expect(resolveLocalImport('/proj/src/a.ts', './missing', fileSet)).toBeNull();
  });
});

describe('buildModuleGraph + buildImportedByTree', () => {
  const scan: ScanResult = {
    files: [
      { file: '/proj/src/a.ts', imports: [importRef('./b')] },
      { file: '/proj/src/b.ts', imports: [] },
    ],
    scanned: 2,
    cached: 0,
    durationMs: 0,
  };

  it('builds the reverse import graph', () => {
    const graph = buildModuleGraph(scan);
    expect([...(graph.importedBy.get('/proj/src/b.ts') ?? [])]).toEqual(['/proj/src/a.ts']);
  });

  it('nests consumers under the direct importer', () => {
    const graph = buildModuleGraph(scan);
    const tree = buildImportedByTree(['/proj/src/b.ts'], graph, '/proj');
    expect(tree).toEqual([{ label: 'src/b.ts', children: [{ label: 'src/a.ts' }] }]);
  });
});
