import { Menu } from '@base-ui/react/menu';
import { PlusIcon } from '@phosphor-icons/react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';

import { type IssueFilter, MAX_FILTER_CONDITIONS } from '@/shared/api';
import { useIssueSearch } from '@/ui/api';
import { Button, buttonClasses, ButtonLink } from '@/ui/components/button';
import { Select, type SelectOption } from '@/ui/components/select';
import { setupURL } from '@/ui/routes/setup/scope-url';

import { ConditionRow } from './condition-row';
import {
  FIELDS,
  isComplete,
  newCondition,
  type Row,
  toFilter,
} from './filter-model';
import { useDebounced } from './use-debounced';

const MATCH_OPTIONS: SelectOption[] = [
  { value: 'all', label: 'all' },
  { value: 'any', label: 'any' },
];

const COUNT_DEBOUNCE_MS = 400;

/** How many issues match the filter so far, as a quiet line of text. */
function MatchCount({ filter }: { filter: IssueFilter }) {
  const settled = useDebounced(filter, COUNT_DEBOUNCE_MS);
  const scope = useMemo(
    () => ({ type: 'custom' as const, filter: settled }),
    [settled],
  );
  const { data, error, isLoading } = useIssueSearch(scope);
  const waiting = settled !== filter || isLoading;

  let text = '';
  if (error !== undefined) {
    text = 'Could not count.';
  } else if (waiting || data === undefined) {
    text = 'Counting…';
  } else {
    text = `${data.items.length}${data.truncated ? '+' : ''} ${data.items.length === 1 ? 'issue matches' : 'issues match'}`;
  }
  return (
    <output className="block font-mono text-sm tabular-nums">{text}</output>
  );
}

/** The custom scope builder: a filter bar that feeds the setup screen. */
export function CustomScopePage() {
  const [match, setMatch] = useState<IssueFilter['match']>('all');
  const [rows, setRows] = useState<Row[]>([]);
  const navigate = useNavigate();
  const filter = useMemo(() => toFilter(match, rows), [match, rows]);
  const used = new Set(rows.map((row) => row.condition.field));

  const add = (field: Row['condition']['field']) => {
    setRows((current) => [
      ...current,
      { key: crypto.randomUUID(), condition: newCondition(field) },
    ]);
  };

  const continueToSetup = () => {
    void navigate(setupURL({ type: 'custom', filter }, 'Custom filter'));
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <h1 className="text-3xl font-semibold">Custom filter</h1>
        <p className="text-gray-700">
          Build a filter the way you would in Linear. Open issues only: done and
          canceled ones are always left out.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {rows.length > 1 ? (
          <div className="flex items-center gap-2 text-sm">
            Match
            <Select
              aria-label="Match"
              value={match}
              options={MATCH_OPTIONS}
              onValueChange={(value) => {
                setMatch(value === 'any' ? 'any' : 'all');
              }}
            />
            of these filters
          </div>
        ) : null}

        {rows.length === 0 ? (
          <p className="border-y border-gray-300 py-6 text-gray-600">
            No filters yet: every open issue matches.
          </p>
        ) : (
          <ul className="border-t border-gray-300">
            {rows.map((row) => (
              <ConditionRow
                key={row.key}
                condition={row.condition}
                complete={isComplete(row.condition)}
                onChange={(condition) => {
                  setRows((current) =>
                    current.map((entry) =>
                      entry.key === row.key ? { ...entry, condition } : entry,
                    ),
                  );
                }}
                onRemove={() => {
                  setRows((current) =>
                    current.filter((entry) => entry.key !== row.key),
                  );
                }}
              />
            ))}
          </ul>
        )}

        <Menu.Root>
          <Menu.Trigger
            disabled={rows.length >= MAX_FILTER_CONDITIONS}
            className={`${buttonClasses('secondary', 'small')} self-start`}
          >
            <PlusIcon className="size-4" aria-hidden="true" />
            Filter
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={6} align="start" className="z-50">
              <Menu.Popup className="max-h-80 min-w-48 overflow-y-auto border border-gray-1000 bg-gray-0 py-1 text-gray-1000 shadow-hard">
                {FIELDS.map(({ field, label }) => (
                  <Menu.Item
                    key={field}
                    onClick={() => {
                      add(field);
                    }}
                    className="flex cursor-pointer items-center justify-between gap-6 px-3 py-2 text-sm data-highlighted:bg-gray-1000 data-highlighted:text-gray-0"
                  >
                    {label}
                    {used.has(field) ? (
                      <span className="font-mono text-xs opacity-60">
                        added
                      </span>
                    ) : null}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>

      <div className="flex flex-col gap-4 border-t border-gray-300 pt-6">
        <MatchCount filter={filter} />
        <div className="flex gap-3">
          <Button variant="primary" onClick={continueToSetup}>
            Continue
          </Button>
          <ButtonLink to="/new">Cancel</ButtonLink>
        </div>
      </div>
    </div>
  );
}
