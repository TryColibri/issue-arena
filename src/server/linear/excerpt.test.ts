import { describe, expect, it } from 'vitest';

import { MAX_EXCERPT_LENGTH } from '@/shared/api';

import { toExcerpt } from './excerpt';

describe('toExcerpt', () => {
  it('returns an empty string for no description', () => {
    expect(toExcerpt(null)).toBe('');
    expect(toExcerpt(undefined)).toBe('');
    expect(toExcerpt('')).toBe('');
  });

  it('strips Markdown syntax', () => {
    const markdown =
      '# Title\n\n- **bold** and _italic_\n- [link](https://x.test)\n\n![img](https://x.test/a.png)\n\n`code`';
    expect(toExcerpt(markdown)).toBe('Title bold and italic link code');
  });

  it('drops code fences', () => {
    expect(toExcerpt('before\n```ts\nconst x = 1;\n```\nafter')).toBe(
      'before after',
    );
  });

  it('collapses whitespace', () => {
    expect(toExcerpt('a \n\n  b\t c')).toBe('a b c');
  });

  it('cuts long text to the limit and marks the cut', () => {
    const excerpt = toExcerpt('word '.repeat(500));
    expect(excerpt).toHaveLength(MAX_EXCERPT_LENGTH);
    expect(excerpt.endsWith('…')).toBe(true);
  });
});
