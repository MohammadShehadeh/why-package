import type { PackageJson } from '../../types';

/** Direct dependency ranges declared in a package.json (prod + dev + optional). */
export function rootRangesFromPackageJson(pkg: PackageJson): Record<string, string> {
  return {
    ...(pkg.dependencies ?? {}),
    ...(pkg.devDependencies ?? {}),
    ...(pkg.optionalDependencies ?? {}),
  };
}

/** Record an installed version for a package, de-duplicating. */
export function addVersion(map: Map<string, string[]>, name: string, version: string): void {
  const existing = map.get(name);
  if (existing) {
    if (!existing.includes(version)) existing.push(version);
  } else {
    map.set(name, [version]);
  }
}
