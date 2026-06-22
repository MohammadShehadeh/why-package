import path from 'node:path';

/** Format a byte count into a human-readable string (e.g. "43 KB"). */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes == null || Number.isNaN(bytes)) return 'unknown';
  if (bytes <= 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const unit = units[exponent] ?? 'B';
  if (exponent === 0) return `${bytes} ${unit}`;

  const value = bytes / 1024 ** exponent;
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  return `${value.toFixed(decimals)} ${unit}`;
}

/** "1 file" / "2 files". */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Project-relative, forward-slashed path for stable terminal output. */
export function toDisplayPath(absolutePath: string, root: string): string {
  const rel = path.relative(root, absolutePath);
  const normalized = rel.split(path.sep).join('/');
  return normalized === '' ? '.' : normalized;
}
