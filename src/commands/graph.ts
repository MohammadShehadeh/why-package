import { chainsToTree, findChains } from '../core/depGraph';
import { loadNormalizedLock } from '../core/lockfile';
import { loadProjectContext } from '../core/project';
import { theme } from '../render/theme';
import { renderRooted } from '../render/tree';
import { type CommonOptions, note } from './shared';

/** Render the dependency graph (root → … → package) from the lockfile. */
export async function runGraph(packageName: string, options: CommonOptions): Promise<void> {
  const ctx = loadProjectContext(options.cwd);
  const lock = loadNormalizedLock(ctx.root, ctx.packageJson);

  if (!lock) {
    if (options.json) {
      console.log(JSON.stringify({ package: packageName, chains: [], lockfile: false }, null, 2));
      return;
    }
    note('No lockfile found — install dependencies to enable graph analysis.');
    return;
  }

  const chains = findChains(lock, packageName, { limit: 25 });

  if (options.json) {
    console.log(
      JSON.stringify({ package: packageName, chains: chains.map((c) => c.nodes) }, null, 2),
    );
    return;
  }

  if (chains.length === 0) {
    console.log(`\n${theme.dim(`"${packageName}" was not found in the dependency tree.`)}`);
    return;
  }

  const rootLabel = theme.title(ctx.packageJson.name ?? 'your-app');
  const tree = chainsToTree(
    chains,
    rootLabel,
    (n) => `${theme.pkg(n.name)}${theme.version(`@${n.version}`)}`,
  );

  console.log(`\n${theme.section('Dependency graph')}\n${renderRooted(tree)}`);
}
