/**
 * Programmatic API for why-package.
 *
 * The CLI is the primary interface, but every analysis primitive is exported
 * here so the tool can be embedded in scripts, dashboards, or CI checks.
 */

export * from './types';

export { ScanCache } from './core/cache';
export { scanProject, type ScanOptions } from './core/scanner';
export { extractImports } from './core/imports';
export { aggregatePackageUsage, collectImportedPackageNames } from './core/usage';
export {
  buildImportedByTree,
  buildModuleGraph,
  resolveLocalImport,
  type ModuleGraph,
} from './core/moduleGraph';

export {
  detectLockfile,
  loadNormalizedLock,
  parseNpmLock,
  parsePnpmLock,
  parseYarnLock,
} from './core/lockfile';
export {
  chainsToTree,
  findChains,
  findDuplicates,
  installedVersions,
  isDirectDependency,
  sortVersionsDesc,
} from './core/depGraph';

export { detectPackageExports } from './core/exports';
export { getBundleInfo, type BundleOptions } from './core/bundlephobia';
export { buildRecommendation, type RecommendationInput } from './core/recommend';

export {
  declaredDependencyNames,
  dependencyType,
  findProjectRoot,
  loadProjectContext,
  ProjectNotFoundError,
  readPackageJson,
} from './core/project';
export {
  directorySize,
  installedVersion,
  readInstalledManifest,
  resolvePackageDir,
} from './core/resolve';

export {
  isBuiltin,
  isRelative,
  packageNameFromSpecifier,
  specifierMatchesPackage,
} from './utils/specifier';
export { formatBytes, pluralize, toDisplayPath } from './utils/format';
