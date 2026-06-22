import { ScanCache } from '../core/cache';
import { loadProjectContext } from '../core/project';
import { scanProject } from '../core/scanner';
import { collectImportedPackageNames } from '../core/usage';
import { renderList } from '../render/output';
import { icons, theme } from '../render/theme';
import { pluralize } from '../utils/format';
import { type CommonOptions, note, printScanSummary } from './shared';

/**
 * Cross-reference declared `dependencies` against what is actually imported.
 * devDependencies and @types/* are excluded — they are usually consumed by
 * tooling or the type system rather than imported in source.
 */
export async function runUnused(options: CommonOptions): Promise<void> {
  const ctx = loadProjectContext(options.cwd);
  const cache = options.cache ? ScanCache.load(ctx.root) : null;

  if (!options.json) note(`Scanning ${ctx.root}…`);
  const scan = await scanProject({ root: ctx.root, cache });
  if (!options.json) printScanSummary(scan);

  const imported = collectImportedPackageNames(scan);
  const candidates = Object.keys(ctx.packageJson.dependencies ?? {});
  const unused = candidates
    .filter((name) => !name.startsWith('@types/') && !imported.has(name))
    .sort();

  if (options.json) {
    console.log(JSON.stringify({ unused, checked: candidates.length }, null, 2));
    return;
  }

  if (unused.length === 0) {
    console.log(`\n${theme.success(icons.success)} No unused dependencies found.`);
    return;
  }

  console.log(`\n${theme.section('Unused dependencies')}\n`);
  console.log(renderList(unused, { marker: icons.cross, color: theme.removed }));
  console.log(
    `\n${theme.dim(
      `${unused.length} of ${pluralize(candidates.length, 'dependency', 'dependencies')} appear unused.`,
    )}`,
  );
  console.log(theme.dim('devDependencies and @types/* are excluded — verify before removing.'));
  process.exitCode = 1;
}
