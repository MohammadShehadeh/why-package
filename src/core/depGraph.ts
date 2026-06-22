import semver from 'semver';
import type { DepChain, DuplicatePackage, NormalizedLock, TreeNode } from '../types';

/** Is the package a direct dependency of the root project? */
export function isDirectDependency(lock: NormalizedLock, name: string): boolean {
  return Object.prototype.hasOwnProperty.call(lock.rootDependencies, name);
}

/** All installed versions of a package, newest first. */
export function installedVersions(lock: NormalizedLock, name: string): string[] {
  return sortVersionsDesc(lock.versionsByName.get(name) ?? []);
}

interface QueueItem {
  name: string;
  version: string;
  path: Array<{ name: string; version: string }>;
}

/**
 * Find dependency chains from the root project down to a target package,
 * breadth-first so the shortest chains come first.
 */
export function findChains(
  lock: NormalizedLock,
  target: string,
  options: { limit?: number } = {},
): DepChain[] {
  const limit = options.limit ?? 8;
  const chains: DepChain[] = [];
  const expanded = new Set<string>();
  const queue: QueueItem[] = [];

  for (const [name, version] of Object.entries(lock.rootDependencies)) {
    queue.push({ name, version, path: [{ name, version }] });
  }

  while (queue.length > 0) {
    const item = queue.shift() as QueueItem;

    if (item.name === target) {
      chains.push({ nodes: item.path });
      if (chains.length >= limit) break;
      continue; // do not traverse beyond the target
    }

    const key = `${item.name}@${item.version}`;
    if (expanded.has(key)) continue;
    expanded.add(key);

    const node = lock.nodes.get(key);
    if (!node) continue;

    for (const [depName, depVersion] of Object.entries(node.dependencies)) {
      queue.push({
        name: depName,
        version: depVersion,
        path: [...item.path, { name: depName, version: depVersion }],
      });
    }
  }

  chains.sort((a, b) => a.nodes.length - b.nodes.length);
  return chains;
}

/** Packages installed at more than one version. */
export function findDuplicates(lock: NormalizedLock): DuplicatePackage[] {
  const duplicates: DuplicatePackage[] = [];
  for (const [name, versions] of lock.versionsByName) {
    const distinct = [...new Set(versions)];
    if (distinct.length > 1) {
      duplicates.push({ name, versions: sortVersionsDesc(distinct) });
    }
  }
  duplicates.sort((a, b) => a.name.localeCompare(b.name));
  return duplicates;
}

/**
 * Merge a set of chains into a single tree rooted at the project. Shared
 * prefixes collapse, so multiple paths to the same package read clearly.
 */
export function chainsToTree(
  chains: DepChain[],
  rootLabel: string,
  formatNode: (node: { name: string; version: string }) => string = (n) => `${n.name}@${n.version}`,
): TreeNode {
  const root: TreeNode = { label: rootLabel, children: [] };

  for (const chain of chains) {
    let cursor = root;
    for (const node of chain.nodes) {
      const label = formatNode(node);
      cursor.children ??= [];
      let child = cursor.children.find((c) => c.label === label);
      if (!child) {
        child = { label, children: [] };
        cursor.children.push(child);
      }
      cursor = child;
    }
  }

  return root;
}

/** Sort versions newest-first, tolerating non-semver values. */
export function sortVersionsDesc(versions: string[]): string[] {
  return [...versions].sort((a, b) => {
    const va = semver.coerce(a);
    const vb = semver.coerce(b);
    if (va && vb) return semver.rcompare(va, vb);
    return b.localeCompare(a);
  });
}
