import { type Issue } from '@/shared/api';

/**
 * The ranking as a numbered Markdown list: `1. [ENG-123] Title — url`.
 *
 * @param ranked - Issues, best first.
 */
export function toMarkdown(ranked: Issue[]): string {
  return ranked
    .map(
      (issue, index) =>
        `${index + 1}. [${issue.identifier}] ${issue.title} — ${issue.url}`,
    )
    .join('\n');
}
