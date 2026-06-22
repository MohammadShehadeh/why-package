import chalk from 'chalk';

/** Status / decoration glyphs used across the CLI output. */
export const icons = {
  success: '✔',
  error: '✖',
  warn: '⚠',
  cross: '❌',
};

/** Semantic, theme-aware text styling. Centralized so colors stay consistent. */
export const theme = {
  title: (s: string) => chalk.bold(s),
  section: (s: string) => chalk.bold.cyan(s),
  dim: (s: string) => chalk.dim(s),
  pkg: (s: string) => chalk.cyan(s),
  version: (s: string) => chalk.dim(s),
  path: (s: string) => chalk.green(s),
  count: (n: number | string) => chalk.yellow(String(n)),
  success: (s: string) => chalk.green(s),
  error: (s: string) => chalk.red(s),
  warn: (s: string) => chalk.yellow(s),
  added: (s: string) => chalk.green(s),
  removed: (s: string) => chalk.red(s),
};

/** Force-enable or disable color output (e.g. for --color / --no-color). */
export function setColorEnabled(enabled: boolean): void {
  if (!enabled) chalk.level = 0;
}
