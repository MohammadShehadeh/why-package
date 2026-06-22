import { beforeAll, describe, expect, it } from 'vitest';
import { renderForest, renderRooted } from '../src/render/tree';
import { setColorEnabled } from '../src/render/theme';

beforeAll(() => setColorEnabled(false));

describe('renderForest', () => {
  it('renders branch guides for a forest', () => {
    const output = renderForest([{ label: 'a' }, { label: 'b', children: [{ label: 'c' }] }]);
    expect(output).toBe(['├─ a', '└─ b', '   └─ c'].join('\n'));
  });

  it('draws vertical guides for non-last branches', () => {
    const output = renderForest([{ label: 'a', children: [{ label: 'a1' }] }, { label: 'b' }]);
    expect(output).toBe(['├─ a', '│  └─ a1', '└─ b'].join('\n'));
  });
});

describe('renderRooted', () => {
  it('keeps the root flush-left with children beneath', () => {
    const output = renderRooted({
      label: 'root',
      children: [{ label: 'a' }, { label: 'b' }],
    });
    expect(output).toBe(['root', '├─ a', '└─ b'].join('\n'));
  });

  it('returns just the label when there are no children', () => {
    expect(renderRooted({ label: 'solo' })).toBe('solo');
  });
});
