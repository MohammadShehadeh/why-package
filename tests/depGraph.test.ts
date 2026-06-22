import { describe, expect, it } from 'vitest';
import {
  chainsToTree,
  findChains,
  findDuplicates,
  installedVersions,
  isDirectDependency,
  sortVersionsDesc,
} from '../src/core/depGraph';
import type { LockNode, NormalizedLock } from '../src/types';

const lock: NormalizedLock = {
  manager: 'npm',
  lockfilePath: 'lock',
  rootDependencies: { a: '1.0.0', d: '1.0.0' },
  nodes: new Map<string, LockNode>([
    ['a@1.0.0', { name: 'a', version: '1.0.0', dependencies: { b: '1.0.0' } }],
    ['b@1.0.0', { name: 'b', version: '1.0.0', dependencies: { c: '1.0.0' } }],
    ['c@1.0.0', { name: 'c', version: '1.0.0', dependencies: {} }],
    ['c@2.0.0', { name: 'c', version: '2.0.0', dependencies: {} }],
    ['d@1.0.0', { name: 'd', version: '1.0.0', dependencies: { c: '2.0.0' } }],
  ]),
  versionsByName: new Map<string, string[]>([
    ['a', ['1.0.0']],
    ['b', ['1.0.0']],
    ['c', ['1.0.0', '2.0.0']],
    ['d', ['1.0.0']],
  ]),
};

describe('findChains', () => {
  it('finds all paths to a package, shortest first', () => {
    const chains = findChains(lock, 'c');
    expect(chains).toHaveLength(2);
    expect(chains[0]?.nodes.map((n) => n.name)).toEqual(['d', 'c']);
    expect(chains[1]?.nodes.map((n) => n.name)).toEqual(['a', 'b', 'c']);
    expect(chains[0]?.nodes.at(-1)).toEqual({ name: 'c', version: '2.0.0' });
  });

  it('returns a single-node chain for a direct dependency', () => {
    const chains = findChains(lock, 'a');
    expect(chains).toEqual([{ nodes: [{ name: 'a', version: '1.0.0' }] }]);
  });

  it('returns nothing for an absent package', () => {
    expect(findChains(lock, 'nope')).toEqual([]);
  });
});

describe('isDirectDependency / installedVersions', () => {
  it('detects direct dependencies', () => {
    expect(isDirectDependency(lock, 'a')).toBe(true);
    expect(isDirectDependency(lock, 'c')).toBe(false);
  });

  it('returns installed versions newest-first', () => {
    expect(installedVersions(lock, 'c')).toEqual(['2.0.0', '1.0.0']);
  });
});

describe('findDuplicates', () => {
  it('reports packages with more than one version', () => {
    expect(findDuplicates(lock)).toEqual([{ name: 'c', versions: ['2.0.0', '1.0.0'] }]);
  });
});

describe('chainsToTree', () => {
  it('merges chains into a shared-prefix tree', () => {
    const tree = chainsToTree(findChains(lock, 'c'), 'root');
    expect(tree.label).toBe('root');
    const topLabels = tree.children?.map((c) => c.label).sort();
    expect(topLabels).toEqual(['a@1.0.0', 'd@1.0.0']);
  });
});

describe('sortVersionsDesc', () => {
  it('sorts semver versions descending', () => {
    expect(sortVersionsDesc(['1.0.0', '2.0.0', '1.5.0'])).toEqual(['2.0.0', '1.5.0', '1.0.0']);
  });
});
