import { describe, expect, it } from 'vitest';
import { formatBytes, pluralize, toDisplayPath } from '../src/utils/format';

describe('formatBytes', () => {
  it('formats common magnitudes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(45_000)).toBe('43.9 KB');
    expect(formatBytes(2_100_000)).toBe('2.00 MB');
  });

  it('handles unknown values', () => {
    expect(formatBytes(null)).toBe('unknown');
    expect(formatBytes(undefined)).toBe('unknown');
    expect(formatBytes(Number.NaN)).toBe('unknown');
  });
});

describe('pluralize', () => {
  it('pluralizes based on count', () => {
    expect(pluralize(1, 'file')).toBe('1 file');
    expect(pluralize(2, 'file')).toBe('2 files');
    expect(pluralize(3, 'dependency', 'dependencies')).toBe('3 dependencies');
  });
});

describe('toDisplayPath', () => {
  it('returns a forward-slashed relative path', () => {
    expect(toDisplayPath('/a/b/c/d.ts', '/a/b')).toBe('c/d.ts');
  });

  it('returns "." for the root itself', () => {
    expect(toDisplayPath('/a/b', '/a/b')).toBe('.');
  });
});
