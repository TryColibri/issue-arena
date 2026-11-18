import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SearchableSelect } from './searchable-select';

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta' },
  { value: 'g', label: 'Gamma' },
];

describe('SearchableSelect', () => {
  const onValueChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const open = async () => {
    render(
      <SearchableSelect
        aria-label="Project"
        options={OPTIONS}
        value=""
        placeholder="Choose…"
        onValueChange={onValueChange}
      />,
    );
    // Base UI opens on mousedown, which jsdom's pointer events don't drive.
    screen.getByRole('combobox', { name: 'Project' }).focus();
    await userEvent.keyboard('{Enter}');
  };

  it('shows the placeholder until something is chosen', () => {
    render(
      <SearchableSelect
        aria-label="Project"
        options={OPTIONS}
        value=""
        placeholder="Choose…"
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveTextContent(
      'Choose…',
    );
  });

  it('shows the chosen option', () => {
    render(
      <SearchableSelect
        aria-label="Project"
        options={OPTIONS}
        value="b"
        onValueChange={onValueChange}
      />,
    );

    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveTextContent(
      'Beta',
    );
  });

  it('filters the options as you type', async () => {
    await open();

    await userEvent.type(
      screen.getByRole('combobox', { name: 'Search' }),
      'ga',
    );

    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option', { name: 'Gamma' })).toBeVisible();
  });

  it('reports the value of the picked option', async () => {
    await open();

    await userEvent.click(screen.getByRole('option', { name: 'Beta' }));

    expect(onValueChange).toHaveBeenCalledExactlyOnceWith('b');
  });
});
