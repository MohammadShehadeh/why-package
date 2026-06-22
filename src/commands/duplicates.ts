import { findDuplicates } from '../core/depGraph';
import { loadNormalizedLock } from '../core/lockfile';
import { loadProjectContext } from '../core/project';
import { icons, theme } from '../render/theme';
import { renderRooted } from '../render/tree';
import { pluralize } from '../utils/format';
import { type CommonOptions, note } from './shared';

/** List packages installed at more than one version, read from the lockfile. */
export async function runDuplicates(options: CommonOptions): Promise<void> {
  const ctx = loadProjectContext(options.cwd);
  const lock = loadNormalizedLock(ctx.root, ctx.packageJson);

  if (!lock) {
    if (options.json) {
      console.log(JSON.stringify({ duplicates: [], lockfile: false }, null, 2));
      return;
    }
    note('No lockfile found — install dependencies to enable duplicate detection.');
    return;
  }

  const duplicates = findDuplicates(lock);

  if (options.json) {
    console.log(JSON.stringify({ duplicates, lockfile: true, manager: lock.manager }, null, 2));
    return;
  }

  if (duplicates.length === 0) {
    console.log(`\n${theme.success(icons.success)} No duplicate versions found.`);
    return;
  }

  const body = duplicates
    .map((dup) =>
      renderRooted({
        label: theme.pkg(dup.name),
        children: dup.versions.map((version) => ({ label: theme.version(version) })),
      }),
    )
    .join('\n\n');

  console.log(`\n${theme.section('Duplicate versions')}\n`);
  console.log(body);
  console.log(
    `\n${theme.dim(`${pluralize(duplicates.length, 'package')} installed at multiple versions.`)}`,
  );
}
