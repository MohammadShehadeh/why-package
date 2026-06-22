import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    cli: 'src/cli.ts',
    index: 'src/index.ts',
  },
  format: ['esm'],
  target: 'node20',
  platform: 'node',
  outDir: 'dist',
  // Only emit type declarations for the library entry point.
  dts: { entry: { index: 'src/index.ts' } },
  clean: true,
  sourcemap: true,
  splitting: false,
  shims: false,
  minify: false,
});
