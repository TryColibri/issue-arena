import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { type Option } from '@/shared/api';
import { useIssueSearch, useOptions } from '@/ui/api';

import { parseSetupParams } from '../setup/scope-url';
import { CustomScopePage } from './custom-scope-page';

vi.mock('@/ui/api');

const mockUseOptions = vi.mocked(useOptions);
const mockUseIssueSearch = vi.mocked(useIssueSearch);

const TEAMS: Option[] = [
  { id: 'team-eng', name: 'Engineering', hint: 'ENG' },
  { id: 'team-ops', name: 'Operations', hint: 'OPS' },
];

const searchResult = (count: number, truncated = false) =>
  ({
    data: { items: Array.from({ length: count }, () => ({})), truncated },
    error: undefined,
    isLoading: false,
  }) as never;

/** Shows where the page navigated to, so the test can read the AST. */
function Where() {
  const location = useLocation();
  return <p data-testid="where">{`${location.pathname}${location.search}`}</p>;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/custom']}>
      <Routes>
        <Route path="custom" element={<CustomScopePage />} />
        <Route path="setup" element={<Where />} />
      </Routes>
    </MemoryRouter>,
  );

const addFilter = async (name: string) => {
  await userEvent.click(screen.getByRole('button', { name: /Filter/ }));
  await userEvent.click(
    await screen.findByRole('menuitem', { name: new RegExp(name) }),
  );
};

const astAfterContinue = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
  const url = new URL(
    screen.getByTestId('where').textContent,
    'https://x.test',
  );
  return parseSetupParams(url.searchParams);
};

describe('CustomScopePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseOptions.mockImplementation(
      (kind) =>
        ({
          data: kind === 'teams' ? TEAMS : [],
          error: undefined,
          isLoading: false,
        }) as never,
    );
    mockUseIssueSearch.mockReturnValue(searchResult(12));
  });

  it('starts with no filters and every issue matching', () => {
    renderPage();
    expect(screen.getByText(/No filters yet/)).toBeInTheDocument();
  });

  it('continues with an empty filter as a custom scope', async () => {
    renderPage();
    expect(await astAfterContinue()).toEqual({
      scope: { type: 'custom', filter: { match: 'all', conditions: [] } },
      label: 'Custom filter',
    });
  });

  it('builds a team condition from a picker', async () => {
    renderPage();
    await addFilter('Team');
    await userEvent.click(screen.getByRole('button', { name: 'team values' }));
    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Engineering/ }),
    );
    expect(await astAfterContinue()).toEqual({
      scope: {
        type: 'custom',
        filter: {
          match: 'all',
          conditions: [{ field: 'team', operator: 'is', ids: ['team-eng'] }],
        },
      },
      label: 'Custom filter',
    });
  });

  it('builds priority and negated conditions, matching any', async () => {
    renderPage();
    await addFilter('Priority');
    await userEvent.click(
      screen.getByRole('button', { name: 'Priority values' }),
    );
    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Urgent/ }),
    );
    await userEvent.click(
      await screen.findByRole('checkbox', { name: /High/ }),
    );
    await userEvent.keyboard('{Escape}');

    await addFilter('Team');
    await userEvent.click(
      screen.getByRole('combobox', { name: 'Team operator' }),
    );
    await userEvent.click(
      await screen.findByRole('option', { name: /is not/i }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'team values' }));
    await userEvent.click(
      await screen.findByRole('checkbox', { name: /Operations/ }),
    );
    await userEvent.keyboard('{Escape}');

    await userEvent.click(screen.getByRole('combobox', { name: 'Match' }));
    await userEvent.click(await screen.findByRole('option', { name: 'any' }));

    expect((await astAfterContinue())?.scope).toEqual({
      type: 'custom',
      filter: {
        match: 'any',
        conditions: [
          { field: 'priority', operator: 'is', values: [1, 2] },
          { field: 'team', operator: 'isNot', ids: ['team-ops'] },
        ],
      },
    });
  });

  it('builds a title condition from text', async () => {
    renderPage();
    await addFilter('Title');
    await userEvent.type(screen.getByLabelText('Title text'), 'login');
    expect((await astAfterContinue())?.scope).toEqual({
      type: 'custom',
      filter: {
        match: 'all',
        conditions: [{ field: 'title', operator: 'contains', value: 'login' }],
      },
    });
  });

  it('leaves out conditions that are not finished, and says so', async () => {
    renderPage();
    await addFilter('Label');
    expect(screen.getByText('Not applied yet')).toBeInTheDocument();
    expect((await astAfterContinue())?.scope).toEqual({
      type: 'custom',
      filter: { match: 'all', conditions: [] },
    });
  });

  it('stops marking a row as not applied once it has a value', async () => {
    renderPage();
    await addFilter('Title');
    expect(screen.getByText('Not applied yet')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Title text'), 'x');
    expect(screen.queryByText('Not applied yet')).not.toBeInTheDocument();
  });

  it('removes a condition', async () => {
    renderPage();
    await addFilter('Title');
    await userEvent.click(
      screen.getByRole('button', { name: /Remove Title filter/ }),
    );
    expect(screen.getByText(/No filters yet/)).toBeInTheDocument();
  });

  it('shows the live count, with a plus when truncated', () => {
    mockUseIssueSearch.mockReturnValue(searchResult(500, true));
    renderPage();
    expect(
      within(screen.getByRole('status')).getByText(
        /500\+ issues match|Counting/,
      ),
    ).toBeInTheDocument();
  });
});
