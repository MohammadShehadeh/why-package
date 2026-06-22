import { describe, expect, it } from 'vitest';
import { aggregatePackageUsage, collectImportedPackageNames } from '../src/core/usage';
import type { ImportRef, ScanResult } from '../src/types';

const ref = (overrides: Partial<ImportRef> & { packageName: string }): ImportRef => ({
  specifier: overrides.packageName,
  named: [],
  hasDefault: false,
  hasNamespace: false,
  kind: 'import',
  ...overrides,
});

const scan: ScanResult = {
  files: [
    {
      file: '/p/a.ts',
      imports: [ref({ packageName: 'react', named: ['useState'], hasDefault: true })],
    },
    { file: '/p/b.ts', imports: [ref({ packageName: 'react', named: ['useEffect'] })] },
    { file: '/p/c.ts', imports: [ref({ packageName: 'lodash', hasDefault: true })] },
  ],
  scanned: 3,
  cached: 0,
  durationMs: 0,
};

describe('aggregatePackageUsage', () => {
  it('merges importers and used exports across files', () => {
    const usage = aggregatePackageUsage(scan, 'react');
    expect(usage.importers).toEqual(['/p/a.ts', '/p/b.ts']);
    expect(usage.usedExports).toEqual(['useEffect', 'useState']);
    expect(usage.usesDefault).toBe(true);
    expect(usage.usesNamespace).toBe(false);
  });

  it('returns empty usage for unimported packages', () => {
    expect(aggregatePackageUsage(scan, 'vue').importers).toEqual([]);
  });
});

describe('collectImportedPackageNames', () => {
  it('lists every distinct imported package', () => {
    expect([...collectImportedPackageNames(scan)].sort()).toEqual(['lodash', 'react']);
  });
});
