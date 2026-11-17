import { TrashIcon } from '@phosphor-icons/react';
import { Link } from 'react-router';
import { useSWRConfig } from 'swr';

import { type ArenaSummary } from '@/shared/api';
import { client, keys, unwrapEmpty, useArenas } from '@/ui/api';
import { removeLocalArena } from '@/ui/arenas';
import { Button } from '@/ui/components/button';

const formatDate = (iso: string): string =>
  new Date(iso).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

type ArenaRowProps = {
  /** The arena to list. */
  arena: ArenaSummary;
};

function ArenaRow({ arena }: ArenaRowProps) {
  const { mutate } = useSWRConfig();

  const remove = async () => {
    await unwrapEmpty(
      client.arenas[':id'].$delete({ param: { id: arena.id } }),
    );
    removeLocalArena(arena.id);
    await mutate(keys.arenas);
  };

  return (
    <tr className="border-b border-gray-300 align-middle">
      <td className="py-3 pr-4 font-medium">{arena.scopeLabel}</td>
      <td className="py-3 pr-4 font-mono text-sm tabular-nums">
        Top {arena.n}
      </td>
      <td className="py-3 pr-4 font-mono text-sm tabular-nums">
        {arena.done ? 'Done' : `${arena.answered} battles`}
      </td>
      <td className="hidden py-3 pr-4 font-mono text-xs text-gray-600 sm:table-cell">
        {formatDate(arena.updatedAt)}
      </td>
      <td className="py-3">
        <span className="flex items-center justify-end gap-3">
          <Link
            to={
              arena.done ? `/arenas/${arena.id}/results` : `/arenas/${arena.id}`
            }
          >
            {arena.done ? 'Results' : 'Resume'}
          </Link>
          <Button
            size="small"
            variant="danger"
            aria-label={`Delete ${arena.scopeLabel}`}
            onClick={remove}
          >
            <TrashIcon className="size-4" aria-hidden="true" />
          </Button>
        </span>
      </td>
    </tr>
  );
}

/** "Your arenas": resume, see results of, or delete earlier arenas. */
export function ArenasTable() {
  const { data: arenas, error } = useArenas();

  if (error !== undefined) {
    return <p className="text-sm text-gray-600">Could not load your arenas.</p>;
  }
  if (arenas === undefined) {
    return <p className="font-mono text-sm text-gray-500">…</p>;
  }
  if (arenas.length === 0) {
    return (
      <p className="text-sm text-gray-600">
        No arenas yet. Pick a scope above to start one.
      </p>
    );
  }
  return (
    <table className="w-full border-t border-gray-300 text-left">
      <thead className="sr-only">
        <tr>
          <th>Scope</th>
          <th>Size</th>
          <th>Progress</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {arenas.map((arena) => (
          <ArenaRow key={arena.id} arena={arena} />
        ))}
      </tbody>
    </table>
  );
}
