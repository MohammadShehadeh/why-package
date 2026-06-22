import { getBundleInfo } from '../core/bundlephobia';
import { ScanCache } from '../core/cache';
import { chainsToTree, findChains, installedVersions, isDirectDependency } from '../core/depGraph';
import { detectPackageExports } from '../core/exports';
import { loadNormalizedLock } from '../core/lockfile';
import { declaredDependencyNames, dependencyType, loadProjectContext } from '../core/project';
import { buildRecommendation } from '../core/recommend';
import { directorySize, readInstalledManifest } from '../core/resolve';
import { scanProject } from '../core/scanner';
import { aggregatePackageUsage, collectImportedPackageNames } from '../core/usage';
import { block, renderBlocks, renderList } from '../render/output';
import { icons, theme } from '../render/theme';
import { renderForest, renderRooted } from '../render/tree';
import { formatBytes, toDisplayPath } from '../utils/format';
import { type CommonOptions, keyValues, note, printScanSummary, suggestNames } from './shared';

export async function runWhy(packageName: string, options: CommonOptions): Promise<void> {
  const ctx = loadProjectContext(options.cwd);
  const cache = options.cache ? ScanCache.load(ctx.root) : null;

  if (!options.json) note(`Scanning ${ctx.root}…`);
  const scan = await scanProject({ root: ctx.root, cache });
  if (!options.json) printScanSummary(scan);

  const usage = aggregatePackageUsage(scan, packageName);
  const importerPaths = usage.importers.map((f) => toDisplayPath(f, ctx.root)).sort();

  const lock = loadNormalizedLock(ctx.root, ctx.packageJson);
  const chains = lock ? findChains(lock, packageName) : [];
  const direct = lock
    ? isDirectDependency(lock, packageName)
    : dependencyType(ctx.packageJson, packageName) !== null;
  const allVersions = lock ? installedVersions(lock, packageName) : [];

  const installed = readInstalledManifest(ctx.root, packageName);
  const version = installed?.manifest.version ?? allVersions[0] ?? null;
  const declaredBucket = dependencyType(ctx.packageJson, packageName);
  const isDeclared = declaredBucket !== null;

  const exportsInfo = detectPackageExports(ctx.root, packageName);
  const usedSet = new Set(usage.usedExports);
  // When the module is imported as default/namespace, members are accessed
  // dynamically (e.g. `yaml.load`) and we cannot reliably flag unused exports.
  const usesWholeModule = usage.usesDefault || usage.usesNamespace;
  const unusedReliable = exportsInfo.all !== null && !usesWholeModule;
  const unusedExports = unusedReliable
    ? (exportsInfo.all as string[]).filter((name) => !usedSet.has(name))
    : [];

  const bundle = options.bundle
    ? await getBundleInfo(packageName, version, { root: ctx.root, noCache: !options.cache })
    : null;

  const exists =
    isDeclared || direct || chains.length > 0 || version !== null || usage.importers.length > 0;

  if (!exists) {
    if (options.json) {
      console.log(JSON.stringify({ package: packageName, found: false }, null, 2));
      return;
    }
    printHeader(packageName, null, 'not found in this project');
    console.log(
      `\n${theme.error(icons.error)} Could not find "${theme.pkg(packageName)}" as a dependency or import.`,
    );
    const suggestions = suggestNames(packageName, [
      ...declaredDependencyNames(ctx.packageJson),
      ...collectImportedPackageNames(scan),
    ]);
    if (suggestions.length > 0) {
      console.log(
        `\n${theme.dim('Did you mean:')}\n${renderList(suggestions, { color: theme.pkg })}`,
      );
    }
    process.exitCode = 1;
    return;
  }

  const recommendation = buildRecommendation({
    packageName,
    usage,
    totalExports: exportsInfo.all?.length ?? null,
    bundle,
    isDeclared,
  });

  if (options.json) {
    console.log(
      JSON.stringify(
        {
          package: packageName,
          found: true,
          installedVersion: version,
          declaredIn: declaredBucket,
          direct,
          installedVersions: allVersions,
          importers: usage.importers.map((f) => toDisplayPath(f, ctx.root)),
          usedExports: usage.usedExports,
          unusedExports: unusedReliable ? unusedExports : null,
          totalExports: exportsInfo.all?.length ?? null,
          usesDefault: usage.usesDefault,
          usesNamespace: usage.usesNamespace,
          chains: chains.map((c) => c.nodes),
          bundle,
          recommendation: recommendation.lines,
        },
        null,
        2,
      ),
    );
    return;
  }

  // ── Header ──────────────────────────────────────────────────────────────
  const status = isDeclared
    ? `declared in ${declaredBucket}`
    : direct
      ? 'direct dependency'
      : chains.length > 0
        ? 'transitive dependency'
        : version
          ? 'installed'
          : 'imported';
  printHeader(packageName, version, status);

  const rootLabel = theme.title(ctx.packageJson.name ?? 'your-app');
  const blocks = [
    block('Imported by', renderImportedBy(importerPaths)),
    block('Dependency chain', renderChain(chains, rootLabel, direct, lock !== null, version)),
    block('Package size', renderSize(installed?.dir ?? null, bundle, options.bundle)),
    block('Used exports', renderUsedExports(usage)),
    block(
      'Unused exports',
      renderUnusedExports(unusedReliable, unusedExports, usage.importers.length),
    ),
    block('Recommendation', recommendation.lines.join('\n')),
  ];

  if (allVersions.length > 1) {
    blocks.splice(
      2,
      0,
      block(
        'Multiple versions',
        `${theme.warn(icons.warn)} Installed at ${allVersions.length} versions: ${allVersions
          .map((v) => theme.version(v))
          .join(', ')}`,
      ),
    );
  }

  console.log(`\n${renderBlocks(blocks)}`);
}

function printHeader(name: string, version: string | null, status: string): void {
  const versionLabel = version ? `  ${theme.version(`v${version}`)}` : '';
  console.log(`\n${theme.pkg(theme.title(name))}${versionLabel}`);
  console.log(theme.dim(status));
}

function renderImportedBy(paths: string[]): string {
  if (paths.length === 0) {
    return theme.dim('No source files import this package directly.');
  }
  return renderForest(paths.map((p) => ({ label: theme.path(p) })));
}

function renderChain(
  chains: ReturnType<typeof findChains>,
  rootLabel: string,
  direct: boolean,
  hasLock: boolean,
  version: string | null,
): string {
  if (chains.length > 0) {
    const tree = chainsToTree(
      chains,
      rootLabel,
      (n) => `${theme.pkg(n.name)}${theme.version(`@${n.version}`)}`,
    );
    const prefix = direct ? '' : `${theme.dim('Not directly installed.')}\n`;
    return prefix + renderRooted(tree);
  }
  if (!hasLock) {
    return theme.dim('No lockfile found — install dependencies to enable chain analysis.');
  }
  if (version) {
    return theme.dim('Installed, but no path from the root project was found.');
  }
  return theme.dim('Not present in the dependency tree.');
}

function renderSize(
  dir: string | null,
  bundle: Awaited<ReturnType<typeof getBundleInfo>> | null,
  bundleRequested: boolean,
): string {
  const pairs: Array<[string, string]> = [];
  if (dir) pairs.push(['Install size (disk)', theme.count(formatBytes(directorySize(dir)))]);

  if (bundle && bundle.source === 'bundlephobia') {
    if (bundle.minified != null)
      pairs.push(['Minified', theme.count(formatBytes(bundle.minified))]);
    if (bundle.gzip != null) pairs.push(['Gzipped', theme.count(formatBytes(bundle.gzip))]);
    if (bundle.dependencyCount != null) {
      pairs.push(['Dependencies', theme.count(String(bundle.dependencyCount))]);
    }
  }

  let body = keyValues(pairs);
  if (bundleRequested && (!bundle || bundle.source !== 'bundlephobia')) {
    const reason = bundle?.error ? ` (${bundle.error})` : '';
    const message = theme.dim(`Bundlephobia size unavailable${reason}.`);
    body = body ? `${body}\n${message}` : message;
  }
  return body;
}

function renderUsedExports(usage: {
  usedExports: string[];
  usesDefault: boolean;
  usesNamespace: boolean;
  importers: string[];
}): string {
  if (usage.importers.length === 0) return '';
  if (usage.usedExports.length > 0) {
    return renderList(usage.usedExports, { color: theme.added });
  }
  if (usage.usesDefault || usage.usesNamespace) {
    return theme.dim('Imported as default / namespace (the whole module).');
  }
  return theme.dim('No named exports detected.');
}

function renderUnusedExports(
  exportsKnown: boolean,
  unused: string[],
  importerCount: number,
): string {
  if (!exportsKnown || importerCount === 0) return '';
  if (unused.length === 0) return theme.dim('All detected exports are used.');
  return renderList(unused, { color: theme.dim });
}
