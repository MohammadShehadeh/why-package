import { describe, expect, it } from 'vitest';
import { buildRecommendation } from '../src/core/recommend';
import type { BundleInfo, PackageUsage } from '../src/types';

const usage = (overrides: Partial<PackageUsage> = {}): PackageUsage => ({
  packageName: 'x',
  importers: [],
  usedExports: [],
  usesDefault: false,
  usesNamespace: false,
  ...overrides,
});

describe('buildRecommendation', () => {
  it('flags a declared but never-imported package', () => {
    const rec = buildRecommendation({
      packageName: 'leftover',
      usage: usage(),
      totalExports: null,
      isDeclared: true,
    });
    const text = rec.lines.join(' ');
    expect(text).toContain('No imports');
    expect(text).toContain('safe to remove');
  });

  it('notes when only a few exports are used', () => {
    const rec = buildRecommendation({
      packageName: 'big-lib',
      usage: usage({ importers: ['a.ts'], usedExports: ['one'] }),
      totalExports: 20,
      isDeclared: true,
    });
    expect(rec.lines.join(' ')).toContain('Only 1 of 20 exports are used');
  });

  it('suggests a known alternative', () => {
    const rec = buildRecommendation({
      packageName: 'moment',
      usage: usage({ importers: ['a.ts'], usesDefault: true }),
      totalExports: null,
      isDeclared: true,
    });
    expect(rec.lines.join(' ')).toContain('Potential alternative');
    expect(rec.lines.join(' ')).toContain('dayjs or date-fns');
  });

  it('warns about large gzip footprint', () => {
    const bundle: BundleInfo = {
      name: 'heavy',
      version: '1.0.0',
      gzip: 60 * 1024,
      minified: 200 * 1024,
      dependencyCount: 5,
      source: 'bundlephobia',
    };
    const rec = buildRecommendation({
      packageName: 'heavy',
      usage: usage({ importers: ['a.ts'], usesDefault: true }),
      totalExports: null,
      bundle,
      isDeclared: true,
    });
    expect(rec.lines.join(' ')).toContain('gzipped');
  });
});
