# why-package

> Understand exactly **why** a dependency exists in your project — and whether you can remove it.

[![npm version](https://img.shields.io/npm/v/why-package.svg)](https://www.npmjs.com/package/why-package)
[![CI](https://github.com/MohammadShehadeh/why-package/actions/workflows/ci.yml/badge.svg)](https://github.com/MohammadShehadeh/why-package/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/why-package.svg)](./LICENSE)
[![node](https://img.shields.io/node/v/why-package.svg)](https://nodejs.org)

`why-package` answers the questions you actually have about your `node_modules`:

- **Where is this package imported?** Which of _my_ files pull it in.
- **Why is it installed at all?** The dependency chain from your app to the package.
- **How big is it?** Install size on disk + minified/gzip size from Bundlephobia.
- **Do I even use it?** Which exports you import — and which you don't.
- **Can I remove it?** Honest, conservative recommendations.

It works with **npm**, **pnpm**, and **yarn** (classic _and_ berry), is fast on
huge repos, and degrades gracefully offline.

---

## Demo

```text
$ pnpm dlx why-package @tanstack/react-query

@tanstack/react-query  v5.59.0
declared in dependencies

Imported by
├─ src/features/users/UserList.tsx
└─ src/hooks/useUsers.ts

Dependency chain
your-app
└─ @tanstack/react-query@5.59.0

Package size
Install size (disk): 3.1 MB
Minified:            2.4 MB
Gzipped:             45 KB
Dependencies:        3

Used exports
- useMutation
- useQuery

Unused exports
- QueryClientProvider
- useInfiniteQuery

Recommendation
Only 2 of 38 exports are used.
Selective imports or a lighter alternative could reduce footprint.
```

---

## Install

Run it instantly with no install:

```bash
pnpm dlx why-package react
# or: npx why-package react
```

Or install it globally:

```bash
pnpm add -g why-package
# npm install -g why-package
# yarn global add why-package
```

Requires **Node.js 20+**.

---

## Usage

### Explain a package

```bash
why-package axios
```

Shows where it's imported, the dependency chain, size, used/unused exports, and a
recommendation.

### Trace a transitive dependency

If a package isn't a direct dependency, `why-package` traces the chain that pulled
it in:

```text
$ why-package ansi-styles

ansi-styles  v4.3.0
transitive dependency

Imported by
No source files import this package directly.

Dependency chain
Not directly installed.
your-app
└─ chalk@4.1.2
   └─ ansi-styles@4.3.0
```

### Find unused dependencies

```text
$ why-package --unused

Unused dependencies

❌ lodash
❌ moment
❌ uuid

3 of 24 dependencies appear unused.
devDependencies and @types/* are excluded — verify before removing.
```

Cross-references your declared `dependencies` against what your source actually
imports.

### Find duplicate versions

```text
$ why-package --duplicates

Duplicate versions

lodash
├─ 4.17.21
└─ 4.17.15

react
├─ 19.0.0
└─ 18.3.1
```

### Show the dependency graph

```text
$ why-package react --graph

Dependency graph
your-app
├─ react@19.0.0
└─ @testing-library/react@16.0.0
   └─ react@19.0.0
```

### Interactive mode

Run with no arguments to pick a package from a searchable list:

```bash
why-package
```

```text
? Which package do you want to explain? › react
  react
  axios
  lodash
  zod
```

### JSON output

Every command supports `--json` for scripting and CI:

```bash
why-package react --json
why-package --unused --json
why-package --duplicates --json
```

### Options

| Option            | Description                                          |
| ----------------- | ---------------------------------------------------- |
| `--unused`        | List declared dependencies that are never imported   |
| `--duplicates`    | List packages installed at multiple versions         |
| `--graph`         | Show the dependency graph for `<package>`            |
| `-C, --cwd <dir>` | Directory to analyze (default: current directory)    |
| `--json`          | Output machine-readable JSON                         |
| `--no-cache`      | Disable the on-disk scan cache                       |
| `--no-bundle`     | Skip the Bundlephobia size lookup (faster / offline) |
| `--no-color`      | Disable colored output                               |
| `-V, --version`   | Print the version                                    |
| `-h, --help`      | Show help                                            |

---

## How it works

1. **Source scan.** Globs your first-party `.js`, `.jsx`, `.ts`, `.tsx`, `.mjs`,
   and `.cjs` files (ignoring `node_modules`, `dist`, `build`, `coverage`,
   `.next`, `.turbo`, and friends) and parses each with
   [ts-morph](https://ts-morph.com) to extract `import`, `require()`, dynamic
   `import()`, and re-export references.
2. **Lockfile graph.** Reads your `package-lock.json`, `pnpm-lock.yaml`, or
   `yarn.lock` and normalizes it into a uniform dependency graph to trace chains
   and detect duplicate versions.
3. **Exports.** Resolves the installed package and reads its TypeScript
   declarations (or ESM entry) to determine which exports you _aren't_ using.
4. **Size.** Combines on-disk install size with [Bundlephobia](https://bundlephobia.com)
   for minified/gzip numbers.

Results are cached per-file by modification time under
`node_modules/.cache/why-package`, so repeat runs are near-instant.

## Supported package managers

| Manager | Lockfile            | Notes                        |
| ------- | ------------------- | ---------------------------- |
| npm     | `package-lock.json` | lockfile v1, v2, v3          |
| pnpm    | `pnpm-lock.yaml`    | v5/v6 inline + v9 snapshots  |
| yarn    | `yarn.lock`         | classic (v1) and berry (v2+) |

## Performance

- Bounded-concurrency file reads and a quick keyword pre-filter before parsing.
- Mtime-based on-disk cache means only changed files are re-parsed.
- Heavy directories are never walked.

Designed to stay responsive on repositories with 100k+ files.

## Programmatic API

Every analysis primitive is exported so you can build your own checks:

```ts
import { scanProject, aggregatePackageUsage, loadProjectContext } from 'why-package';

const ctx = loadProjectContext(process.cwd());
const scan = await scanProject({ root: ctx.root });
const usage = aggregatePackageUsage(scan, 'lodash');

console.log(usage.importers); // files that import lodash
console.log(usage.usedExports); // named exports actually used
```

See [`src/index.ts`](./src/index.ts) for the full surface.

## Accuracy & caveats

`why-package` favors being honest over being confident:

- **Unused dependencies** only checks runtime `dependencies` (not
  `devDependencies` or `@types/*`, which are usually consumed by tooling or the
  type system). Packages used via config, CLIs, or plugins can show as unused —
  always verify before removing.
- **Unused exports** is suppressed when a package is imported as a default or
  namespace (e.g. `import _ from 'lodash'`), because member access can't be
  tracked statically.
- **Bundle size** comes from Bundlephobia and is skipped gracefully when offline
  (`--no-bundle` to always skip).

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) to get started.

## License

[MIT](./LICENSE) © why-package contributors
