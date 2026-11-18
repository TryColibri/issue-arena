import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

import { HomePage } from './home-page';

vi.mock('./arenas-table', () => ({
  ArenasTable: () => <p>arenas table</p>,
}));

describe('HomePage', () => {
  it('lists the arenas and links to a new one', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.getByText('arenas table')).toBeDefined();
    expect(
      screen.getByRole('link', { name: 'New arena' }).getAttribute('href'),
    ).toBe('/new');
  });

  it('does not ask for a scope', () => {
    render(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    );

    expect(screen.queryByText('What do you want to rank?')).toBeNull();
  });
});
