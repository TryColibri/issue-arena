import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { nextBattle } from '@/shared/arena';
import type * as Api from '@/ui/api';
import { client } from '@/ui/api';
import { readLocalArena, writeLocalArena } from '@/ui/arenas';
import { TEST_ARENA_ID, testArena, testIssue } from '@/ui/arenas/test-arena';

import { ArenaPage } from './arena-page';
import { sidesOf } from './battle-sides';

vi.mock('@/ui/api', async (importOriginal) => {
  const actual = await importOriginal<typeof Api>();
  return {
    ...actual,
    client: { arenas: { ':id': { $get: vi.fn(), $put: vi.fn() } } },
  };
});

const mockGet = vi.mocked(client.arenas[':id'].$get);
const mockPut = vi.mocked(client.arenas[':id'].$put);

const renderArena = () =>
  render(
    <MemoryRouter initialEntries={[`/arenas/${TEST_ARENA_ID}`]}>
      <Routes>
        <Route path="arenas/:id" element={<ArenaPage />} />
        <Route path="arenas/:id/results" element={<p>RESULTS PAGE</p>} />
      </Routes>
    </MemoryRouter>,
  );

const side = (name: 'Left' | 'Right') =>
  screen.getByRole('region', { name: new RegExp(`${name} issue`) });

/** The identifier shown on a side of the screen. */
const shown = (name: 'Left' | 'Right') =>
  within(side(name)).getByText(/^T-/).textContent;

describe('ArenaPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockGet.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: '',
      json: async () => ({ type: 'x', title: 'x', status: 404, detail: 'x' }),
    } as never);
    mockPut.mockResolvedValue({
      ok: true,
      status: 204,
      statusText: '',
      json: async () => null,
    } as never);
  });

  it('shows two issues, with progress', async () => {
    writeLocalArena(testArena());
    renderArena();
    expect(await screen.findByText(/Battle 1 ·/)).toBeInTheDocument();
    expect(side('Left')).toBeInTheDocument();
    expect(side('Right')).toBeInTheDocument();
    expect(screen.getByText(/left$/)).toBeInTheDocument();
  });

  it('shows the two issues of the pending battle', async () => {
    writeLocalArena(testArena());
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    const battle = nextBattle(testArena());
    const sides = sidesOf(battle ?? { a: '', b: '' });
    expect(shown('Left')).toContain(`T-${sides.left}`);
    expect(shown('Right')).toContain(`T-${sides.right}`);
  });

  it('picks the left issue with ← and the right one with →', async () => {
    writeLocalArena(testArena());
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    const battle = nextBattle(testArena());
    const sides = sidesOf(battle ?? { a: '', b: '' });

    await userEvent.keyboard('{ArrowLeft}');
    expect(readLocalArena(TEST_ARENA_ID)?.answers.at(-1)?.winner).toBe(
      sides.left,
    );
    expect(await screen.findByText(/Battle 2 ·/)).toBeInTheDocument();

    const second = nextBattle(readLocalArena(TEST_ARENA_ID) ?? testArena());
    const secondSides = sidesOf(second ?? { a: '', b: '' });
    await userEvent.keyboard('{ArrowRight}');
    expect(readLocalArena(TEST_ARENA_ID)?.answers.at(-1)?.winner).toBe(
      secondSides.right,
    );
  });

  it('picks with the button too', async () => {
    writeLocalArena(testArena());
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    await userEvent.click(
      within(side('Left')).getByRole('button', { name: /more important/ }),
    );
    expect(readLocalArena(TEST_ARENA_ID)?.answers).toHaveLength(1);
  });

  it('undoes with U', async () => {
    writeLocalArena(testArena());
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    await userEvent.keyboard('{ArrowLeft}');
    expect(await screen.findByText(/Battle 2 ·/)).toBeInTheDocument();
    await userEvent.keyboard('u');
    expect(await screen.findByText(/Battle 1 ·/)).toBeInTheDocument();
    expect(readLocalArena(TEST_ARENA_ID)?.answers).toEqual([]);
  });

  it('drops with D and then a side', async () => {
    writeLocalArena(testArena());
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    const battle = nextBattle(testArena());
    const sides = sidesOf(battle ?? { a: '', b: '' });

    await userEvent.keyboard('d');
    expect(
      screen.getByText(/Which one should not compete/),
    ).toBeInTheDocument();
    await userEvent.keyboard('{ArrowRight}');

    expect(readLocalArena(TEST_ARENA_ID)?.dropped).toEqual([sides.right]);
    expect(readLocalArena(TEST_ARENA_ID)?.answers).toEqual([]);
    expect(
      screen.queryByText(/Which one should not compete/),
    ).not.toBeInTheDocument();
  });

  it('cancels a drop with Escape', async () => {
    writeLocalArena(testArena());
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    await userEvent.keyboard('d');
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{ArrowLeft}');
    expect(readLocalArena(TEST_ARENA_ID)?.dropped).toEqual([]);
    expect(readLocalArena(TEST_ARENA_ID)?.answers).toHaveLength(1);
  });

  it('ignores shortcuts while typing and with modifiers', async () => {
    writeLocalArena(testArena());
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    await userEvent.keyboard('{ArrowLeft}u');
    input.remove();
    await userEvent.keyboard('{Control>}{ArrowLeft}{/Control}');
    expect(readLocalArena(TEST_ARENA_ID)?.answers).toEqual([]);
  });

  it('goes to the results when the top list is complete', async () => {
    writeLocalArena(
      testArena({ n: 1, candidates: [testIssue('a'), testIssue('b')] }),
    );
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    await userEvent.keyboard('{ArrowLeft}');
    expect(await screen.findByText('RESULTS PAGE')).toBeInTheDocument();
  });

  it('says so when the arena does not exist', async () => {
    renderArena();
    expect(await screen.findByText('Arena not found')).toBeInTheDocument();
  });

  it('shows the live top list', async () => {
    writeLocalArena(testArena({ n: 2 }));
    renderArena();
    await screen.findByText(/Battle 1 ·/);
    expect(screen.getByText(/Top 2 so far/)).toBeInTheDocument();
  });
});
