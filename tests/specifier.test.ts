import { describe, expect, it } from 'vitest';
import {
  isBuiltin,
  isRelative,
  packageNameFromSpecifier,
  specifierMatchesPackage,
} from '../src/utils/specifier';

describe('packageNameFromSpecifier', () => {
  it('returns bare package names', () => {
    expect(packageNameFromSpecifier('lodash')).toBe('lodash');
  });

  it('strips subpaths', () => {
    expect(packageNameFromSpecifier('lodash/fp')).toBe('lodash');
  });

  it('keeps the scope for scoped packages', () => {
    expect(packageNameFromSpecifier('@tanstack/react-query')).toBe('@tanstack/react-query');
  });

  it('strips subpaths from scoped packages', () => {
    expect(packageNameFromSpecifier('@scope/pkg/sub/path')).toBe('@scope/pkg');
  });

  it('returns null for relative, builtin and protocol specifiers', () => {
    expect(packageNameFromSpecifier('./local')).toBeNull();
    expect(packageNameFromSpecifier('../up')).toBeNull();
    expect(packageNameFromSpecifier('node:fs')).toBeNull();
    expect(packageNameFromSpecifier('fs')).toBeNull();
    expect(packageNameFromSpecifier('http://example.com/x.js')).toBeNull();
    expect(packageNameFromSpecifier('')).toBeNull();
  });
});

describe('isRelative / isBuiltin', () => {
  it('detects relative specifiers', () => {
    expect(isRelative('./a')).toBe(true);
    expect(isRelative('/abs')).toBe(true);
    expect(isRelative('pkg')).toBe(false);
  });

  it('detects builtins with and without the node: prefix', () => {
    expect(isBuiltin('fs')).toBe(true);
    expect(isBuiltin('node:path')).toBe(true);
    expect(isBuiltin('lodash')).toBe(false);
  });
});

describe('specifierMatchesPackage', () => {
  it('matches a subpath import to its package', () => {
    expect(specifierMatchesPackage('lodash/fp', 'lodash')).toBe(true);
    expect(specifierMatchesPackage('lodash', 'underscore')).toBe(false);
  });
});
