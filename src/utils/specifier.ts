import { builtinModules } from 'node:module';

const BUILTINS = new Set<string>([...builtinModules, ...builtinModules.map((m) => `node:${m}`)]);

/** A specifier that resolves to a relative/absolute path rather than a package. */
export function isRelative(specifier: string): boolean {
  return specifier.startsWith('.') || specifier.startsWith('/');
}

/** A Node.js builtin module (with or without the `node:` prefix). */
export function isBuiltin(specifier: string): boolean {
  return specifier.startsWith('node:') || BUILTINS.has(specifier);
}

/**
 * Extract the bare package name from a module specifier.
 *
 * - "lodash"            -> "lodash"
 * - "lodash/fp"         -> "lodash"
 * - "@scope/pkg/sub"    -> "@scope/pkg"
 * - "./local", "node:fs", "http://..." -> null
 */
export function packageNameFromSpecifier(specifier: string): string | null {
  if (!specifier || isRelative(specifier) || isBuiltin(specifier)) return null;
  // Reject protocol-style specifiers (data:, http:, file:, etc.).
  if (specifier.includes(':')) return null;

  const parts = specifier.split('/');
  if (specifier.startsWith('@')) {
    const [scope, name] = parts;
    if (!scope || !name) return null;
    return `${scope}/${name}`;
  }
  return parts[0] || null;
}
