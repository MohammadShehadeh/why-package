# Contributing to why-package

Thanks for your interest in improving `why-package`! 🎉

## Getting started

```bash
git clone https://github.com/MohammadShehadeh/why-package.git
cd why-package
pnpm install
```

This project uses [pnpm](https://pnpm.io). With [Corepack](https://nodejs.org/api/corepack.html)
(`corepack enable`) the version pinned in `package.json` is used automatically.

### Useful scripts

| Script               | What it does                         |
| -------------------- | ------------------------------------ |
| `pnpm build`         | Bundle the CLI and library with tsup |
| `pnpm dev`           | Rebuild on change                    |
| `pnpm test`          | Run the test suite (Vitest)          |
| `pnpm test:watch`    | Run tests in watch mode              |
| `pnpm test:coverage` | Run tests with coverage              |
| `pnpm typecheck`     | Type-check with `tsc --noEmit`       |
| `pnpm format`        | Format with Prettier                 |

### Running the CLI locally

```bash
pnpm build
node dist/cli.js react --cwd /path/to/some/project
```

## Project structure

```
src/
├─ cli.ts            # Commander entry point
├─ commands/         # One module per command (why, unused, duplicates, graph, interactive)
├─ core/             # Analysis engine
│  ├─ scanner.ts     #   source file scanning
│  ├─ imports.ts     #   ts-morph import extraction
│  ├─ lockfile/      #   npm / pnpm / yarn parsers → normalized graph
│  ├─ depGraph.ts    #   chains, duplicates, tree merging
│  ├─ exports.ts     #   package export detection
│  ├─ bundlephobia.ts#   size lookups
│  └─ ...
├─ render/           # Tree + themed terminal output
└─ utils/            # Small helpers
```

## Guidelines

- **Add a test** for any bug fix or new behavior. Parsers especially benefit from
  a fixture in `tests/`.
- **Keep modules focused.** The `core/` engine should not import from `render/`
  or `commands/`.
- **Run `pnpm typecheck` and `pnpm test`** before opening a PR.
- **Be honest in output.** Prefer "could not determine" over a confident guess.

## Commit messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add support for bun.lockb
fix: handle scoped packages in yarn berry lockfiles
docs: clarify unused-dependency caveats
```

## Reporting bugs

Open an issue with the command you ran, the package manager, and the output you
expected vs. what you got. A minimal reproduction is gold.

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
