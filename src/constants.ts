/** File extensions scanned for imports. */
export const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'] as const;

/** Directories never worth scanning for first-party source code. */
export const DEFAULT_IGNORE_DIRS = [
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.git',
  '.cache',
  '.output',
  'out',
  '.vercel',
  '.netlify',
  '.svelte-kit',
  '.nuxt',
  'storybook-static',
] as const;

/** Lockfile name for each supported package manager. */
export const LOCKFILES: Record<'npm' | 'pnpm' | 'yarn', string> = {
  npm: 'package-lock.json',
  pnpm: 'pnpm-lock.yaml',
  yarn: 'yarn.lock',
};

/** Cache location, relative to the project root. */
export const CACHE_DIR = 'node_modules/.cache/why-package';

/** Bump when the cached scan shape changes, to invalidate old caches. */
export const CACHE_VERSION = 1;

/** Bundlephobia API endpoint. */
export const BUNDLEPHOBIA_API = 'https://bundlephobia.com/api/size';
