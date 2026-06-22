import type { ScanResult } from '../types';
import { theme } from '../render/theme';
import { pluralize } from '../utils/format';

/** Options shared by every command. */
export interface CommonOptions {
  cwd: string;
  cache: boolean;
  color: boolean;
  bundle: boolean;
  json: boolean;
}

/** Print a transient status line to stderr, keeping stdout clean for pipes/JSON. */
export function note(message: string): void {
  process.stderr.write(`${theme.dim(message)}\n`);
}

export function printScanSummary(scan: ScanResult): void {
  const cached = scan.cached > 0 ? ` (${scan.cached} cached)` : '';
  note(`Scanned ${pluralize(scan.scanned, 'file')} in ${scan.durationMs}ms${cached}`);
}

/** Suggest declared/imported names similar to a (possibly mistyped) query. */
export function suggestNames(query: string, candidates: Iterable<string>, limit = 5): string[] {
  const q = query.toLowerCase();
  const normalize = (s: string) => s.replace(/[@/_-]/g, '');
  const scored: Array<{ name: string; score: number }> = [];

  for (const name of candidates) {
    const n = name.toLowerCase();
    if (n === q) continue;
    let score = Number.POSITIVE_INFINITY;
    if (n.includes(q) || q.includes(n)) score = Math.abs(n.length - q.length);
    else if (normalize(n).includes(normalize(q))) score = 50;
    if (Number.isFinite(score)) scored.push({ name, score });
  }

  scored.sort((a, b) => a.score - b.score || a.name.localeCompare(b.name));
  return scored.slice(0, limit).map((s) => s.name);
}

/** Aligned "key: value" lines. */
export function keyValues(pairs: Array<[string, string]>): string {
  if (pairs.length === 0) return '';
  const width = Math.max(...pairs.map(([key]) => key.length));
  return pairs
    .map(([key, value]) => `${theme.dim(`${key}:`.padEnd(width + 1))} ${value}`)
    .join('\n');
}
