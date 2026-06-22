import { theme } from './theme';

export interface Block {
  title: string;
  body: string;
}

/** A titled section: bold cyan heading followed by its body. */
export function block(title: string, body: string): Block {
  return { title, body };
}

/** Join non-empty blocks with a blank line between them. */
export function renderBlocks(blocks: Array<Block | null | undefined>): string {
  return blocks
    .filter((b): b is Block => Boolean(b && b.body.trim().length > 0))
    .map((b) => `${theme.section(b.title)}\n${b.body}`)
    .join('\n\n');
}

export interface ListOptions {
  marker?: string;
  color?: (s: string) => string;
  empty?: string;
}

/** Render a simple marker list, one item per line. */
export function renderList(items: readonly string[], options: ListOptions = {}): string {
  const { marker = '-', color, empty = theme.dim('(none)') } = options;
  if (items.length === 0) return empty;
  return items.map((item) => `${theme.dim(marker)} ${color ? color(item) : item}`).join('\n');
}
