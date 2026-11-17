import { type Issue } from '@/shared/api';
import { type MultiSelectOption } from '@/ui/components/multi-select';

/** The setup screen's filter chips. An empty list means "any". */
export type SetupFilters = {
  /** Team keys. */
  teams: string[];
  /** State names. */
  states: string[];
  /** Priorities, as the strings `0` to `4`. */
  priorities: string[];
  /** Label names: an issue matches when it has at least one. */
  labels: string[];
};

/** No filter at all. */
export const NO_FILTERS: SetupFilters = {
  teams: [],
  states: [],
  priorities: [],
  labels: [],
};

const matches = (selected: string[], value: string): boolean =>
  selected.length === 0 || selected.includes(value);

/**
 * The issues that pass every filter chip. Within a chip any value matches;
 * across chips all must.
 *
 * @param issues - Issues in scope.
 * @param filters - The chips.
 */
export function filterIssues(issues: Issue[], filters: SetupFilters): Issue[] {
  return issues.filter(
    (issue) =>
      matches(filters.teams, issue.teamKey) &&
      matches(filters.states, issue.state.name) &&
      matches(filters.priorities, String(issue.priority)) &&
      (filters.labels.length === 0 ||
        issue.labels.some((label) => filters.labels.includes(label))),
  );
}

/** The choices each chip offers, drawn from the issues in scope. */
export type Facets = {
  /** Teams present, by key. */
  teams: MultiSelectOption[];
  /** States present, by name. */
  states: MultiSelectOption[];
  /** Priorities present, most urgent first, none last. */
  priorities: MultiSelectOption[];
  /** Labels present, by name. */
  labels: MultiSelectOption[];
};

const byLabel = (x: MultiSelectOption, y: MultiSelectOption): number =>
  x.label.localeCompare(y.label);

const rank = (priority: number): number => (priority === 0 ? 5 : priority);

/**
 * What the chips can filter on, with how many issues each choice has.
 *
 * @param issues - Issues in scope.
 */
export function facetsOf(issues: Issue[]): Facets {
  const count = (pick: (issue: Issue) => string[]): Map<string, number> => {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      for (const value of new Set(pick(issue))) {
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
    }
    return counts;
  };
  const options = (counts: Map<string, number>): MultiSelectOption[] =>
    [...counts]
      .map(([value, total]) => ({ value, label: value, hint: String(total) }))
      .toSorted(byLabel);

  const priorities = new Map<string, { label: string; total: number }>();
  for (const issue of issues) {
    const key = String(issue.priority);
    priorities.set(key, {
      label: issue.priorityLabel,
      total: (priorities.get(key)?.total ?? 0) + 1,
    });
  }

  return {
    teams: options(count((issue) => [issue.teamKey])),
    states: options(count((issue) => [issue.state.name])),
    priorities: [...priorities]
      .toSorted(([x], [y]) => rank(Number(x)) - rank(Number(y)))
      .map(([value, { label, total }]) => ({
        value,
        label,
        hint: String(total),
      })),
    labels: options(count((issue) => issue.labels)),
  };
}

/**
 * Parses the "top N" input, clamped to `1..max`.
 *
 * @param text - What the user typed.
 * @param max - How many issues compete. At least 1 is returned even for 0.
 * @param fallback - Used when `text` is not a number.
 */
export function clampN(text: string, max: number, fallback = 10): number {
  const parsed = Number.parseInt(text, 10);
  const value = Number.isNaN(parsed) ? fallback : parsed;
  return Math.min(Math.max(1, value), Math.max(1, max));
}
