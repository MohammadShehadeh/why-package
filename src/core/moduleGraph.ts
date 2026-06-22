import path from 'node:path';
import { SOURCE_EXTENSIONS } from '../constants';
import type { ScanResult, TreeNode } from '../types';
import { toDisplayPath } from '../utils/format';
import { isRelative } from '../utils/specifier';

/** First-party module dependency graph, in both directions. */
export interface ModuleGraph {
  /** importer file -> local files it imports. */
  imports: Map<string, Set<string>>;
  /** file -> files that import it. */
  importedBy: Map<string, Set<string>>;
}

/** TypeScript lets `./foo.js` resolve to `./foo.ts`; map known equivalents. */
const JS_TO_TS: Record<string, string[]> = {
  '.js': ['.ts', '.tsx'],
  '.jsx': ['.tsx'],
  '.mjs': ['.mts'],
  '.cjs': ['.cts'],
};

/**
 * Resolve a relative import specifier to an actual scanned file. Tries the
 * literal path, common source extensions, and `index.*` directory entries.
 * Only matches files that were actually scanned (no disk access).
 */
export function resolveLocalImport(
  importerFile: string,
  specifier: string,
  fileSet: ReadonlySet<string>,
): string | null {
  const base = path.resolve(path.dirname(importerFile), specifier);
  const ext = path.extname(base);
  const candidates: string[] = [];

  if (ext && (SOURCE_EXTENSIONS as readonly string[]).includes(ext)) {
    candidates.push(base);
    const withoutExt = base.slice(0, -ext.length);
    for (const mapped of JS_TO_TS[ext] ?? []) candidates.push(withoutExt + mapped);
  } else {
    for (const sourceExt of SOURCE_EXTENSIONS) candidates.push(base + sourceExt);
    for (const sourceExt of SOURCE_EXTENSIONS) {
      candidates.push(path.join(base, `index${sourceExt}`));
    }
  }

  for (const candidate of candidates) {
    if (fileSet.has(candidate)) return candidate;
  }
  return null;
}

/** Build the first-party import graph from scan results. */
export function buildModuleGraph(scan: ScanResult): ModuleGraph {
  const fileSet = new Set(scan.files.map((f) => f.file));
  const imports = new Map<string, Set<string>>();
  const importedBy = new Map<string, Set<string>>();

  for (const fileImports of scan.files) {
    const deps = new Set<string>();
    for (const ref of fileImports.imports) {
      if (!isRelative(ref.specifier)) continue;
      const resolved = resolveLocalImport(fileImports.file, ref.specifier, fileSet);
      if (resolved && resolved !== fileImports.file) deps.add(resolved);
    }
    imports.set(fileImports.file, deps);

    for (const dep of deps) {
      let consumers = importedBy.get(dep);
      if (!consumers) {
        consumers = new Set<string>();
        importedBy.set(dep, consumers);
      }
      consumers.add(fileImports.file);
    }
  }

  return { imports, importedBy };
}

export interface ImportedByTreeOptions {
  maxDepth?: number;
  maxChildren?: number;
}

/**
 * Build a tree rooted at each file that directly imports the target package,
 * nesting the files that (transitively) consume it underneath. Cycles are
 * broken along each path and depth/breadth are capped to keep output readable.
 */
export function buildImportedByTree(
  directImporters: readonly string[],
  graph: ModuleGraph,
  root: string,
  options: ImportedByTreeOptions = {},
): TreeNode[] {
  const maxDepth = options.maxDepth ?? 6;
  const maxChildren = options.maxChildren ?? 8;

  function build(file: string, ancestry: ReadonlySet<string>, depth: number): TreeNode {
    const node: TreeNode = { label: toDisplayPath(file, root) };
    if (depth >= maxDepth) return node;

    const consumers = [...(graph.importedBy.get(file) ?? [])]
      .filter((consumer) => !ancestry.has(consumer))
      .sort();
    if (consumers.length === 0) return node;

    const shown = consumers.slice(0, maxChildren);
    const nextAncestry = new Set(ancestry).add(file);
    node.children = shown.map((consumer) => build(consumer, nextAncestry, depth + 1));
    if (consumers.length > shown.length) {
      node.children.push({ label: `…and ${consumers.length - shown.length} more` });
    }
    return node;
  }

  return [...directImporters].sort().map((file) => build(file, new Set(), 0));
}
