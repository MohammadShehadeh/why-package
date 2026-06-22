import type { LockNode, NormalizedLock, PackageJson } from '../../types';
import { addVersion, rootRangesFromPackageJson } from './shared';

interface NpmPackageEntry {
  name?: string;
  version?: string;
  resolved?: string;
  link?: boolean;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

interface NpmV1Dep {
  version?: string;
  requires?: Record<string, string>;
  dependencies?: Record<string, NpmV1Dep>;
}

interface NpmLockfile {
  lockfileVersion?: number;
  packages?: Record<string, NpmPackageEntry>;
  dependencies?: Record<string, NpmV1Dep>;
}

/** Parse a package-lock.json (or npm-shrinkwrap.json) into a normalized graph. */
export function parseNpmLock(
  content: string,
  lockfilePath: string,
  packageJson: PackageJson,
): NormalizedLock {
  const data = JSON.parse(content) as NpmLockfile;
  if (data.packages && Object.keys(data.packages).length > 0) {
    return fromPackagesMap(data.packages, lockfilePath);
  }
  return fromLegacyTree(data.dependencies ?? {}, lockfilePath, packageJson);
}

/** Modern lockfileVersion 2/3: a flat map keyed by install path. */
function fromPackagesMap(
  packages: Record<string, NpmPackageEntry>,
  lockfilePath: string,
): NormalizedLock {
  const nodes = new Map<string, LockNode>();
  const versionsByName = new Map<string, string[]>();

  const nameFromKey = (key: string): string => {
    const marker = 'node_modules/';
    const idx = key.lastIndexOf(marker);
    if (idx === -1) return packages[key]?.name ?? key;
    return key.slice(idx + marker.length);
  };

  // Node-resolution: find where `dep` installs, as seen from `fromPath`.
  const resolveInstallKey = (fromPath: string, dep: string): string | null => {
    let dir = fromPath;
    while (true) {
      const prefix = dir === '' ? '' : `${dir}/`;
      const candidate = `${prefix}node_modules/${dep}`;
      if (packages[candidate]) return candidate;
      if (dir === '') return null;
      const idx = dir.lastIndexOf('/node_modules/');
      dir = idx === -1 ? '' : dir.slice(0, idx);
    }
  };

  for (const [key, entry] of Object.entries(packages)) {
    if (key === '' || entry.link || !entry.version) continue;
    addVersion(versionsByName, nameFromKey(key), entry.version);
  }

  for (const [key, entry] of Object.entries(packages)) {
    if (key === '' || entry.link || !entry.version) continue;
    const name = nameFromKey(key);
    const declared = { ...entry.dependencies, ...entry.optionalDependencies };
    const dependencies: Record<string, string> = {};
    for (const [depName, range] of Object.entries(declared)) {
      const childKey = resolveInstallKey(key, depName);
      dependencies[depName] = (childKey ? packages[childKey]?.version : undefined) ?? range;
    }

    const nodeKey = `${name}@${entry.version}`;
    const existing = nodes.get(nodeKey);
    if (existing) Object.assign(existing.dependencies, dependencies);
    else nodes.set(nodeKey, { name, version: entry.version, dependencies });
  }

  const rootEntry = packages[''] ?? {};
  const rootDeclared = {
    ...rootEntry.dependencies,
    ...rootEntry.devDependencies,
    ...rootEntry.optionalDependencies,
  };
  const rootDependencies: Record<string, string> = {};
  for (const [depName, range] of Object.entries(rootDeclared)) {
    const childKey = resolveInstallKey('', depName);
    rootDependencies[depName] = (childKey ? packages[childKey]?.version : undefined) ?? range;
  }

  return { manager: 'npm', lockfilePath, rootDependencies, nodes, versionsByName };
}

/** Legacy lockfileVersion 1: a nested dependency tree. Resolution is best-effort. */
function fromLegacyTree(
  tree: Record<string, NpmV1Dep>,
  lockfilePath: string,
  packageJson: PackageJson,
): NormalizedLock {
  const nodes = new Map<string, LockNode>();
  const versionsByName = new Map<string, string[]>();
  const globalVersion = new Map<string, string>();

  const collect = (deps: Record<string, NpmV1Dep>): void => {
    for (const [name, dep] of Object.entries(deps)) {
      if (dep.version) {
        addVersion(versionsByName, name, dep.version);
        globalVersion.set(name, dep.version);
      }
      if (dep.dependencies) collect(dep.dependencies);
    }
  };
  collect(tree);

  const build = (deps: Record<string, NpmV1Dep>, inherited: Map<string, string>): void => {
    for (const [name, dep] of Object.entries(deps)) {
      if (!dep.version) continue;
      const scope = new Map(inherited);
      for (const [childName, child] of Object.entries(dep.dependencies ?? {})) {
        if (child.version) scope.set(childName, child.version);
      }
      const dependencies: Record<string, string> = {};
      for (const reqName of Object.keys(dep.requires ?? {})) {
        const resolved = scope.get(reqName) ?? globalVersion.get(reqName);
        if (resolved) dependencies[reqName] = resolved;
      }
      const nodeKey = `${name}@${dep.version}`;
      const existing = nodes.get(nodeKey);
      if (existing) Object.assign(existing.dependencies, dependencies);
      else nodes.set(nodeKey, { name, version: dep.version, dependencies });

      if (dep.dependencies) build(dep.dependencies, scope);
    }
  };
  build(tree, new Map());

  const rootDependencies: Record<string, string> = {};
  for (const [name, range] of Object.entries(rootRangesFromPackageJson(packageJson))) {
    rootDependencies[name] = tree[name]?.version ?? globalVersion.get(name) ?? range;
  }

  return { manager: 'npm', lockfilePath, rootDependencies, nodes, versionsByName };
}
