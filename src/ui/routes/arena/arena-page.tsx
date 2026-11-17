import { Link, Navigate, useParams } from 'react-router';

import { useArena } from '@/ui/arenas';

import { Battle } from './battle';

type ArenaProps = {
  /** Arena UUID. */
  id: string;
};

function Arena({ id }: ArenaProps) {
  const play = useArena(id);

  if (play.status === 'loading') {
    return <p className="px-6 py-12 font-mono text-sm text-gray-500">…</p>;
  }
  if (play.status === 'missing') {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
        <h1 className="text-2xl font-semibold">Arena not found</h1>
        <p className="text-gray-700">
          It was deleted, or it belongs to another account.{' '}
          <Link to="/">Back to your arenas</Link>.
        </p>
      </div>
    );
  }
  if (play.battle === null) {
    return <Navigate to="results" replace />;
  }
  return <Battle play={play} />;
}

/** `/arenas/:id`: the battle screen, or the results once the top list is complete. */
export function ArenaPage() {
  const { id } = useParams();
  return id === undefined ? null : <Arena key={id} id={id} />;
}
