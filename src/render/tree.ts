import type { TreeNode } from '../types';
import { theme } from './theme';

export interface TreeOptions {
  /** Style applied to the branch guides (├─, └─, │). */
  guide?: (s: string) => string;
}

/**
 * Render a forest of tree nodes with box-drawing guides. Every top-level node
 * gets its own connector — use this for lists like "imported by".
 */
export function renderForest(nodes: readonly TreeNode[], options: TreeOptions = {}): string {
  const guide = options.guide ?? theme.dim;
  const lines: string[] = [];

  const walk = (node: TreeNode, prefix: string, isLast: boolean): void => {
    lines.push(prefix + guide(isLast ? '└─ ' : '├─ ') + node.label);
    const children = node.children ?? [];
    const childPrefix = prefix + guide(isLast ? '   ' : '│  ');
    children.forEach((child, index) => walk(child, childPrefix, index === children.length - 1));
  };

  nodes.forEach((node, index) => walk(node, '', index === nodes.length - 1));
  return lines.join('\n');
}

/**
 * Render a single rooted tree: the root label sits flush-left and its children
 * branch beneath it — use this for dependency chains and graphs.
 */
export function renderRooted(root: TreeNode, options: TreeOptions = {}): string {
  const children = root.children ?? [];
  if (children.length === 0) return root.label;
  return `${root.label}\n${renderForest(children, options)}`;
}
