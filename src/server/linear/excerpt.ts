import { MAX_EXCERPT_LENGTH } from '@/shared/api';

/**
 * Turns a Linear issue description (Markdown) into a short plain-text
 * excerpt: images and code fences dropped, links reduced to their text,
 * Markdown syntax removed, whitespace collapsed, cut to `MAX_EXCERPT_LENGTH`.
 *
 * @param markdown - The description, or `null`/empty when there is none.
 * @returns Plain text, ending in `…` when it was cut.
 */
export function toExcerpt(markdown: string | null | undefined): string {
  if (markdown === null || markdown === undefined) {
    return '';
  }
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
    .replace(/(\*\*|__|~~|`)/g, '')
    .replace(/(^|\s)[*_]+|[*_]+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= MAX_EXCERPT_LENGTH) {
    return text;
  }
  return `${text.slice(0, MAX_EXCERPT_LENGTH - 1).trimEnd()}…`;
}
