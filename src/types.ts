/**
 * Shared domain types for why-package.
 */

export type PackageManager = 'npm' | 'pnpm' | 'yarn';

/** How a module specifier entered a file. */
export type ImportKind = 'import' | 'require' | 'dynamic' | 'export';

/** A single import / require / dynamic-import reference found in a source file. */
export interface ImportRef {
  /** Raw module specifier, e.g. "@tanstack/react-query" or "./foo". */
  specifier: string;
  /** Resolved bare package name, or null for relative / builtin specifiers. */
  packageName: string | null;
  /** Named bindings, e.g. `import { a, b }` -> ["a", "b"]. */
  named: string[];
  /** `import x from '...'` or `const x = require('...')`. */
  hasDefault: boolean;
  /** `import * as ns from '...'`. */
  hasNamespace: boolean;
  /** Where the reference came from. */
  kind: ImportKind;
}

/** All imports extracted from a single source file. */
export interface FileImports {
  /** Absolute file path. */
  file: string;
  imports: ImportRef[];
}

/** Result of scanning a project's source tree. */
export interface ScanResult {
  files: FileImports[];
  /** Total source files considered. */
  scanned: number;
  /** How many were served from cache. */
  cached: number;
  durationMs: number;
}

/** Aggregated picture of how one package is used across the source tree. */
export interface PackageUsage {
  packageName: string;
  /** Absolute paths of files that directly import the package. */
  importers: string[];
  /** Union of named bindings imported across all importers. */
  usedExports: string[];
  /** Some importer used a default import. */
  usesDefault: boolean;
  /** Some importer used a namespace (`* as`) import. */
  usesNamespace: boolean;
}

/** A package as recorded in a lockfile. */
export interface LockNode {
  name: string;
  version: string;
  /** Resolved direct dependencies: depName -> version (or range when unresolved). */
  dependencies: Record<string, string>;
}

/** A lockfile normalized into a uniform graph, independent of package manager. */
export interface NormalizedLock {
  manager: PackageManager;
  lockfilePath: string;
  /** Root project's direct dependencies: name -> version or range. */
  rootDependencies: Record<string, string>;
  /** Every installed package keyed by `name@version`. */
  nodes: Map<string, LockNode>;
  /** name -> sorted list of distinct installed versions. */
  versionsByName: Map<string, string[]>;
}

/** A path from the root project down to a target package. */
export interface DepChain {
  nodes: Array<{ name: string; version: string }>;
}

/** A package installed at more than one version. */
export interface DuplicatePackage {
  name: string;
  versions: string[];
}

/** Bundle size estimate (typically from Bundlephobia). */
export interface BundleInfo {
  name: string;
  version: string | null;
  /** Gzipped size in bytes. */
  gzip: number | null;
  /** Minified size in bytes (Bundlephobia "size"). */
  minified: number | null;
  /** Number of dependencies counted by Bundlephobia. */
  dependencyCount: number | null;
  source: 'bundlephobia' | 'unavailable';
  error?: string;
}

/** Named exports detected from an installed package. */
export interface PackageExports {
  /** Detected named exports, or null when they could not be determined. */
  all: string[] | null;
  source: 'types' | 'esm' | 'unknown';
}

/** Minimal view of a package.json. */
export interface PackageJson {
  name?: string;
  version?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  workspaces?: string[] | { packages?: string[] };
  [key: string]: unknown;
}

/** Resolved information about the project being analyzed. */
export interface ProjectContext {
  /** Absolute project root (directory containing package.json). */
  root: string;
  packageJson: PackageJson;
  /** Detected package manager, or null when no lockfile is present. */
  manager: PackageManager | null;
  /** Absolute path to the detected lockfile, if any. */
  lockfilePath: string | null;
}

/** A generic node for ASCII tree rendering. */
export interface TreeNode {
  label: string;
  children?: TreeNode[];
}

/** A suggested alternative for a dependency. */
export interface Recommendation {
  /** Human-readable lines describing the recommendation. */
  lines: string[];
  /** Suggested alternative package, if any. */
  alternative?: string;
}
