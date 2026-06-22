import { load as loadYaml } from 'js-yaml';
import semver from 'semver';
import type { LockNode, NormalizedLock, PackageJson } from '../../types';
import { addVersion, rootRangesFromPackageJson } from './shared';

interface YarnEntry {
  version: string;
  dependencies: Record<string, string>;
}

/** Parse a yarn.lock (classic v1 or berry v2+) into a normalized graph. */
export function parseYarnLock(
  content: string,
  lockfilePath: string,
  packageJson: PackageJson,
): NormalizedLock {
  const isBerry = /(^|\n)__metadata:/.test(content);
  const descriptors = isBerry ? parseBerry(content) : parseClassic(content);

  const versionsByName = new Map<string, string[]>();
  const nodes = new Map<string, LockNode>();
  const rangesByName = new Map<string, Array<{ range: string; version: string }>>();

  for (const [descriptor, entry] of descriptors) {
    const { name, range } = splitNameRange(descriptor);
    if (!name || !entry.version) continue;
    addVersion(versionsByName, name, entry.version);
    const list = rangesByName.get(name) ?? [];
    list.push({ range: stripProtocol(range), version: entry.version });
    rangesByName.set(name, list);
  }

  const resolve = (name: string, rawRange: string): string | undefined => {
    const range = stripProtocol(rawRange);
    const candidates = rangesByName.get(name);
    if (!candidates || candidates.length === 0) return undefined;
    const exact = candidates.find((c) => c.range === range);
    if (exact) return exact.version;
    const valid = candidates.map((c) => c.version).filter((v) => semver.valid(v));
    const max = semver.maxSatisfying(valid, range);
    return max ?? candidates[0]?.version;
  };

  const builtNodes = new Set<string>();
  for (const [descriptor, entry] of descriptors) {
    const { name } = splitNameRange(descriptor);
    if (!name || !entry.version) continue;
    const nodeKey = `${name}@${entry.version}`;
    if (builtNodes.has(nodeKey)) continue;
    builtNodes.add(nodeKey);

    const dependencies: Record<string, string> = {};
    for (const [depName, depRange] of Object.entries(entry.dependencies)) {
      dependencies[depName] = resolve(depName, depRange) ?? stripProtocol(depRange);
    }
    nodes.set(nodeKey, { name, version: entry.version, dependencies });
  }

  // yarn.lock omits the root project's own deps; take them from package.json.
  const rootDependencies: Record<string, string> = {};
  for (const [name, range] of Object.entries(rootRangesFromPackageJson(packageJson))) {
    rootDependencies[name] = resolve(name, range) ?? range;
  }

  return { manager: 'yarn', lockfilePath, rootDependencies, nodes, versionsByName };
}

/** Classic (v1) yarn.lock: blocks separated by blank lines. */
function parseClassic(content: string): Map<string, YarnEntry> {
  const result = new Map<string, YarnEntry>();

  for (const block of content.split(/\n\s*\n/)) {
    const lines = block
      .split(/\r?\n/)
      .filter((line) => line.length > 0 && !line.trimStart().startsWith('#'));
    const header = lines[0];
    if (!header || /^\s/.test(header) || !header.trimEnd().endsWith(':')) continue;

    const descriptors = splitDescriptors(header.trimEnd().slice(0, -1));
    let version = '';
    const dependencies: Record<string, string> = {};
    let section: 'deps' | 'other' | null = null;

    for (let i = 1; i < lines.length; i++) {
      const raw = lines[i] as string;
      const trimmed = raw.trim();
      const indent = raw.length - raw.trimStart().length;

      if (indent <= 2) {
        if (trimmed.startsWith('version ')) {
          version = unquote(trimmed.slice('version '.length).trim());
          section = null;
        } else if (trimmed === 'dependencies:' || trimmed === 'optionalDependencies:') {
          section = 'deps';
        } else if (trimmed.endsWith(':')) {
          section = 'other';
        } else {
          section = null;
        }
      } else if (section === 'deps') {
        const dep = parseDepLine(trimmed);
        if (dep) dependencies[dep.name] = dep.range;
      }
    }

    const entry: YarnEntry = { version, dependencies };
    for (const descriptor of descriptors) result.set(descriptor, entry);
  }

  return result;
}

/** Berry (v2+) yarn.lock is valid YAML. */
function parseBerry(content: string): Map<string, YarnEntry> {
  const result = new Map<string, YarnEntry>();
  const data = (loadYaml(content) ?? {}) as Record<string, unknown>;

  for (const [headerKey, value] of Object.entries(data)) {
    if (headerKey === '__metadata' || !value || typeof value !== 'object') continue;
    const record = value as { version?: unknown; dependencies?: Record<string, unknown> };
    const version = record.version == null ? '' : String(record.version);
    const dependencies: Record<string, string> = {};
    for (const [name, range] of Object.entries(record.dependencies ?? {})) {
      dependencies[name] = String(range);
    }
    const entry: YarnEntry = { version, dependencies };
    for (const descriptor of headerKey.split(',').map((s) => s.trim())) {
      result.set(descriptor, entry);
    }
  }

  return result;
}

function splitDescriptors(header: string): string[] {
  const parts: string[] = [];
  let current = '';
  let inQuote = false;
  for (const char of header) {
    if (char === '"') {
      inQuote = !inQuote;
    } else if (char === ',' && !inQuote) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseDepLine(line: string): { name: string; range: string } | null {
  let rest = line;
  let name: string;
  if (rest.startsWith('"')) {
    const end = rest.indexOf('"', 1);
    if (end === -1) return null;
    name = rest.slice(1, end);
    rest = rest.slice(end + 1).trim();
  } else {
    const space = rest.indexOf(' ');
    if (space === -1) return null;
    name = rest.slice(0, space);
    rest = rest.slice(space + 1).trim();
  }
  return { name, range: unquote(rest) };
}

function splitNameRange(descriptor: string): { name: string; range: string } {
  const at = descriptor.lastIndexOf('@');
  if (at <= 0) return { name: descriptor, range: '' };
  return { name: descriptor.slice(0, at), range: descriptor.slice(at + 1) };
}

function stripProtocol(range: string): string {
  return range.startsWith('npm:') ? range.slice(4) : range;
}

function unquote(value: string): string {
  return value.replace(/^"/, '').replace(/"$/, '');
}
