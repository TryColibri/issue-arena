import { PlusIcon } from '@phosphor-icons/react';

import { ButtonLink } from '@/ui/components/button';

import { ArenasTable } from './arenas-table';

/** Signed in: pick up an earlier arena, or start a new one. */
export function HomePage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold">Your arenas</h1>
        <ButtonLink to="/new" variant="primary">
          <PlusIcon className="size-4" aria-hidden="true" />
          New arena
        </ButtonLink>
      </div>
      <ArenasTable />
    </div>
  );
}
