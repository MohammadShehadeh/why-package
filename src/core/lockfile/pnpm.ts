import { load as loadYaml } from 'js-yaml';
import type { LockNode, NormalizedLock } from '../../types';
import { addVersion } from './shared';

type DepRef = { specifier?: string; version?: string } | string;

interface PnpmEntry {
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

interface PnpmImporter {
  dependencies?: Record<string, DepRef>;
  devDependencies?: Record<string, DepRef>;
  optionalDependencies?: Record<string, DepRef>;
}

interface PnpmLockfile {
  importers?: Record<string, PnpmImporter>;
  dependencies?: Record<string, DepRef>;
  devDependencies?: Record<string, DepRef>;
  optionalDependencies?: Record<string, DepRef>;
  packages?: Record<string, PnpmEntry>;
  snapshots?: Record<string, PnpmEntry>;
}

/** Parse a pnpm-lock.yaml into a normalized graph. */
export function parsePnpmLock(content: string, lockfilePath: string): NormalizedLock {
  const data = (loadYaml(content) ?? {}) as PnpmLockfile;
  const nodes = new Map<string, LockNode>();
  const versionsByName = new Map<string, string[]>();

  for (const key of Object.keys(data.packages ?? {})) {
    const parsed = parseKey(key);
    if (parsed) addVersion(versionsByName, parsed.name, parsed.version);
  }

  // pnpm v9 keeps the graph in `snapshots`; older versions inline it in `packages`.
  const edges =
    data.snapshots && Object.keys(data.snapshots).length > 0
      ? data.snapshots
      : (data.packages ?? {});

  for (const [key, entry] of Object.entries(edges)) {
    const parsed = parseKey(key);
    if (!parsed) continue;
    addVersion(versionsByName, parsed.name, parsed.version);

    const declared = { ...entry?.dependencies, ...entry?.optionalDependencies };
    const dependencies: Record<string, string> = {};
    for (const [depName, ref] of Object.entries(declared)) {
      dependencies[depName] = normalizeRef(ref);
    }

    const nodeKey = `${parsed.name}@${parsed.version}`;
    const existing = nodes.get(nodeKey);
    if (existing) Object.assign(existing.dependencies, dependencies);
    else nodes.set(nodeKey, { name: parsed.name, version: parsed.version, dependencies });
  }

  const rootDependencies: Record<string, string> = {};
  const rootImporter = data.importers?.['.'];
  const buckets: Array<Record<string, DepRef> | undefined> = rootImporter
    ? [rootImporter.dependencies, rootImporter.devDependencies, rootImporter.optionalDependencies]
    : [data.dependencies, data.devDependencies, data.optionalDependencies];

  for (const bucket of buckets) {
    for (const [name, ref] of Object.entries(bucket ?? {})) {
      rootDependencies[name] = normalizeRef(ref);
    }
  }

  return { manager: 'pnpm', lockfilePath, rootDependencies, nodes, versionsByName };
}

/** Strip the leading `/`, peer-deps suffix, and protocol noise from a key. */
function parseKey(rawKey: string): { name: string; version: string } | null {
  let key = rawKey.startsWith('/') ? rawKey.slice(1) : rawKey;
  const paren = key.indexOf('(');
  if (paren !== -1) key = key.slice(0, paren);

  // Modern format: name@version (name may be @scope/pkg).
  const at = key.lastIndexOf('@');
  if (at > 0) {
    const name = key.slice(0, at);
    const version = key.slice(at + 1);
    if (/^[0-9]/.test(version)) return { name, version };
  }

  // Legacy v5 format: name/version.
  const slash = key.lastIndexOf('/');
  if (slash > 0) {
    const name = key.slice(0, slash);
    const version = key.slice(slash + 1);
    if (/^[0-9]/.test(version)) return { name, version };
  }

  return null;
}

function normalizeRef(ref: DepRef | undefined): string {
  if (!ref) return '';
  const raw = typeof ref === 'string' ? ref : (ref.version ?? '');
  const paren = raw.indexOf('(');
  return paren === -1 ? raw : raw.slice(0, paren);
}
