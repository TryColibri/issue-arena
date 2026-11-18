import { useId, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';

import { type Arena, MAX_ARENA_ISSUES, type Scope } from '@/shared/api';
import { estimateBattles, orderCandidates } from '@/shared/arena';
import { ApiError, useIssueSearch } from '@/ui/api';
import { writeLocalArena } from '@/ui/arenas';
import { Button, ButtonLink } from '@/ui/components/button';

import { FilterChip } from './filter-chip';
import {
  clampN,
  facetsOf,
  filterIssues,
  NO_FILTERS,
  type SetupFilters,
} from './filter-issues';
import { parseSetupParams } from './scope-url';

const DEFAULT_N = 3;

type SetupProps = {
  /** What to rank. */
  scope: Scope;
  /** The scope's display name. */
  label: string;
};

function Setup({ scope, label }: SetupProps) {
  const { data, error, isLoading } = useIssueSearch(scope);
  const [filters, setFilters] = useState<SetupFilters>(NO_FILTERS);
  const [nText, setNText] = useState(String(DEFAULT_N));
  const nID = useId();
  const navigate = useNavigate();

  const issues = useMemo(() => data?.items ?? [], [data]);
  const facets = useMemo(() => facetsOf(issues), [issues]);
  const matching = useMemo(
    () => filterIssues(issues, filters),
    [issues, filters],
  );
  const candidates = useMemo(
    () => orderCandidates(matching).slice(0, MAX_ARENA_ISSUES),
    [matching],
  );
  const n = clampN(nText, candidates.length, DEFAULT_N);
  const battles = estimateBattles({ count: candidates.length, n });

  const setFilter = (key: keyof SetupFilters) => {
    return (values: string[]) => {
      setFilters((current) => ({ ...current, [key]: values }));
    };
  };

  const start = () => {
    const at = new Date().toISOString();
    const arena: Arena = {
      id: crypto.randomUUID(),
      scopeLabel: label,
      scope,
      n,
      candidates,
      answers: [],
      dropped: [],
      revision: 0,
      createdAt: at,
      updatedAt: at,
    };
    writeLocalArena(arena);
    void navigate(`/arenas/${arena.id}`);
  };

  if (error !== undefined) {
    return (
      <p role="alert" className="border border-gray-1000 px-4 py-3 text-sm">
        {error instanceof ApiError ? error.message : 'Could not load issues.'}
      </p>
    );
  }
  if (isLoading) {
    return <p className="font-mono text-sm text-gray-500">Loading issues…</p>;
  }
  if (issues.length === 0) {
    return (
      <p className="text-gray-700">
        No open issues match this scope. Try another one.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-10">
      <dl className="grid grid-cols-2 gap-6 border-y border-gray-300 py-6 sm:grid-cols-3">
        <div>
          <dt className="font-mono text-xs text-gray-600">Issues</dt>
          <dd className="font-mono text-3xl tabular-nums">
            {candidates.length}
          </dd>
        </div>
        <div>
          <dt className="font-mono text-xs text-gray-600">Estimated battles</dt>
          <dd className="font-mono text-3xl tabular-nums">≈ {battles}</dd>
        </div>
        <div>
          <dt className="font-mono text-xs text-gray-600">Top</dt>
          <dd className="font-mono text-3xl tabular-nums">{n}</dd>
        </div>
      </dl>

      {matching.length > MAX_ARENA_ISSUES ? (
        <output className="block text-sm text-gray-700">
          Keeping the {MAX_ARENA_ISSUES} highest-priority issues out of{' '}
          {matching.length}. Use the filters to narrow it down.
        </output>
      ) : null}
      {data?.truncated === true ? (
        <output className="block text-sm text-gray-700">
          This scope has more than {issues.length} issues; only the first{' '}
          {issues.length} were loaded.
        </output>
      ) : null}

      <section className="flex flex-col gap-3" aria-label="Filters">
        <h2 className="font-mono text-xs tracking-wider text-gray-600 uppercase">
          Filters
        </h2>
        <div className="flex flex-wrap gap-3">
          <FilterChip
            name="Team"
            options={facets.teams}
            values={filters.teams}
            onValuesChange={setFilter('teams')}
          />
          <FilterChip
            name="State"
            options={facets.states}
            values={filters.states}
            onValuesChange={setFilter('states')}
          />
          <FilterChip
            name="Priority"
            options={facets.priorities}
            values={filters.priorities}
            onValuesChange={setFilter('priorities')}
          />
          <FilterChip
            name="Label"
            options={facets.labels}
            values={filters.labels}
            onValuesChange={setFilter('labels')}
          />
        </div>
      </section>

      <div className="flex flex-col gap-2">
        <label htmlFor={nID} className="text-sm font-medium">
          How many do you want ranked?
        </label>
        <input
          id={nID}
          type="number"
          inputMode="numeric"
          min={1}
          max={Math.max(1, candidates.length)}
          value={nText}
          onChange={(event) => {
            setNText(event.target.value);
          }}
          onBlur={() => {
            setNText(String(n));
          }}
          className="min-h-11 w-28 border border-gray-300 bg-gray-0 px-3 font-mono tabular-nums hover:border-gray-1000"
        />
      </div>

      <div className="flex gap-3">
        <Button
          variant="primary"
          disabled={candidates.length === 0}
          onClick={start}
        >
          Start arena
        </Button>
        <ButtonLink to="/new">Cancel</ButtonLink>
      </div>
    </div>
  );
}

/** Before the arena: how many issues, how many battles, filters and N. */
export function SetupPage() {
  const [params] = useSearchParams();
  const parsed = parseSetupParams(params);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-16">
      <h1 className="text-3xl font-semibold">
        {parsed === null ? 'Set up an arena' : parsed.label}
      </h1>
      {parsed === null ? (
        <p className="text-gray-700">
          That link is missing its scope.{' '}
          <Link to="/new">Choose what to rank</Link>.
        </p>
      ) : (
        <Setup scope={parsed.scope} label={parsed.label} />
      )}
    </div>
  );
}
