import { describe, expect, it } from 'vitest';
import { extractImports } from '../src/core/imports';

describe('extractImports', () => {
  it('extracts named imports', () => {
    const [ref] = extractImports(
      'a.ts',
      `import { useQuery, useMutation } from '@tanstack/react-query';`,
    );
    expect(ref).toMatchObject({
      packageName: '@tanstack/react-query',
      named: ['useQuery', 'useMutation'],
      kind: 'import',
      hasDefault: false,
    });
  });

  it('extracts default and namespace imports', () => {
    const refs = extractImports(
      'a.ts',
      `import axios from 'axios';\nimport * as React from 'react';`,
    );
    expect(refs.find((r) => r.packageName === 'axios')).toMatchObject({ hasDefault: true });
    expect(refs.find((r) => r.packageName === 'react')).toMatchObject({ hasNamespace: true });
  });

  it('handles type-only imports', () => {
    const [ref] = extractImports('a.ts', `import type { Foo } from 'bar';`);
    expect(ref).toMatchObject({ packageName: 'bar', named: ['Foo'] });
  });

  it('extracts require with destructuring', () => {
    const [ref] = extractImports('a.js', `const { pick, omit } = require('lodash');`);
    expect(ref).toMatchObject({ packageName: 'lodash', named: ['pick', 'omit'], kind: 'require' });
  });

  it('extracts plain require as whole-module', () => {
    const [ref] = extractImports('a.js', `const dayjs = require('dayjs');`);
    expect(ref).toMatchObject({ packageName: 'dayjs', kind: 'require', hasDefault: true });
  });

  it('extracts dynamic imports', () => {
    const [ref] = extractImports('a.ts', `const mod = await import('chalk');`);
    expect(ref).toMatchObject({ packageName: 'chalk', kind: 'dynamic', hasNamespace: true });
  });

  it('extracts re-exports', () => {
    const [ref] = extractImports('a.ts', `export { foo } from 'bar';`);
    expect(ref).toMatchObject({ packageName: 'bar', named: ['foo'], kind: 'export' });
  });

  it('treats export-star as whole-module', () => {
    const [ref] = extractImports('a.ts', `export * from 'baz';`);
    expect(ref).toMatchObject({ packageName: 'baz', hasNamespace: true, kind: 'export' });
  });

  it('parses tsx with JSX', () => {
    const refs = extractImports(
      'c.tsx',
      `import React from 'react';\nexport const A = () => <div className="x">hi</div>;`,
    );
    expect(refs.find((r) => r.packageName === 'react')).toBeTruthy();
  });

  it('marks relative and builtin specifiers with a null package name', () => {
    const refs = extractImports(
      'a.ts',
      `import './styles.css';\nimport fs from 'node:fs';\nimport { x } from '../util';`,
    );
    expect(refs.every((r) => r.packageName === null)).toBe(true);
  });

  it('returns nothing for files without module syntax', () => {
    expect(extractImports('a.ts', `const x = 1; console.log(x);`)).toEqual([]);
  });
});
