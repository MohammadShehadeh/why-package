#!/usr/bin/env node
import path from 'node:path';
import { Command } from 'commander';
import pkg from '../package.json';
import { runDuplicates } from './commands/duplicates';
import { runGraph } from './commands/graph';
import { runInteractive } from './commands/interactive';
import type { CommonOptions } from './commands/shared';
import { runUnused } from './commands/unused';
import { runWhy } from './commands/why';
import { ProjectNotFoundError } from './core/project';
import { icons, setColorEnabled, theme } from './render/theme';

interface RawOptions {
  unused?: boolean;
  duplicates?: boolean;
  graph?: boolean;
  cwd: string;
  json?: boolean;
  cache: boolean;
  color: boolean;
  bundle: boolean;
}

const program = new Command();

program
  .name('why-package')
  .description(
    'Understand why a dependency exists in your project — and whether you can remove it.',
  )
  .version(pkg.version, '-V, --version', 'output the version number')
  .argument('[package]', 'package to explain (omit to pick interactively)')
  .option('--unused', 'list declared dependencies that are never imported')
  .option('--duplicates', 'list packages installed at multiple versions')
  .option('--graph', 'show the dependency graph for <package>')
  .option('-C, --cwd <dir>', 'directory to analyze', process.cwd())
  .option('--json', 'output machine-readable JSON')
  .option('--no-cache', 'disable the on-disk scan cache')
  .option('--no-color', 'disable colored output')
  .option('--no-bundle', 'skip the Bundlephobia size lookup')
  .addHelpText(
    'after',
    `
Examples:
  $ why-package react-query        Explain why a package is installed
  $ why-package ansi-styles        Trace a transitive dependency
  $ why-package --unused           Find dependencies that are never imported
  $ why-package --duplicates       Find packages installed at many versions
  $ why-package react --graph      Show the dependency graph for a package
  $ why-package                    Pick a package interactively
`,
  )
  .action(async (packageArg: string | undefined, raw: RawOptions) => {
    if (!raw.color) setColorEnabled(false);

    const options: CommonOptions = {
      cwd: path.resolve(raw.cwd),
      cache: raw.cache,
      bundle: raw.bundle,
      json: raw.json ?? false,
    };

    try {
      if (raw.unused) {
        await runUnused(options);
      } else if (raw.duplicates) {
        await runDuplicates(options);
      } else if (packageArg && raw.graph) {
        await runGraph(packageArg, options);
      } else if (packageArg) {
        await runWhy(packageArg, options);
      } else {
        await runInteractive(options);
      }
    } catch (error) {
      handleError(error);
    }
  });

function handleError(error: unknown): void {
  if (error instanceof ProjectNotFoundError) {
    console.error(`\n${theme.error(icons.error)} ${error.message}`);
    console.error(theme.dim('Run why-package inside a project, or pass --cwd <dir>.'));
  } else {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`\n${theme.error(icons.error)} ${message}`);
    if (process.env.WHY_PACKAGE_DEBUG && error instanceof Error) {
      console.error(error.stack);
    }
  }
  process.exitCode = 1;
}

program.parseAsync(process.argv).catch(handleError);
