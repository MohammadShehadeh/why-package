import { search } from '@inquirer/prompts';
import { loadProjectContext } from '../core/project';
import { type CommonOptions, note } from './shared';
import { runWhy } from './why';

/** Prompt the user to pick a dependency, then explain it. */
export async function runInteractive(options: CommonOptions): Promise<void> {
  const ctx = loadProjectContext(options.cwd);
  const candidates = [
    ...new Set([
      ...Object.keys(ctx.packageJson.dependencies ?? {}),
      ...Object.keys(ctx.packageJson.devDependencies ?? {}),
    ]),
  ].sort();

  if (candidates.length === 0) {
    note('No dependencies found in package.json.');
    return;
  }

  let selection: string;
  try {
    selection = await search<string>({
      message: 'Which package do you want to explain?',
      source: (term) => {
        const query = (term ?? '').toLowerCase();
        return candidates
          .filter((name) => !query || name.toLowerCase().includes(query))
          .slice(0, 25)
          .map((name) => ({ name, value: name }));
      },
    });
  } catch (error) {
    // Graceful exit on Ctrl-C / Esc.
    if (error instanceof Error && error.name === 'ExitPromptError') return;
    throw error;
  }

  await runWhy(selection, options);
}
