import { CheckIcon, CopyIcon } from '@phosphor-icons/react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';

import { type Issue } from '@/shared/api';
import { useArena } from '@/ui/arenas';
import { Button, ButtonLink } from '@/ui/components/button';
import { StateIcon } from '@/ui/components/issue-icons';

import { toMarkdown } from './to-markdown';

type ResultsProps = {
  /** Arena UUID. */
  id: string;
};

function Results({ id }: ResultsProps) {
  const play = useArena(id);
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  if (play.status === 'loading') {
    return <p className="px-6 py-12 font-mono text-sm text-gray-500">…</p>;
  }
  if (play.arena === null) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <h1 className="text-2xl font-semibold">Arena not found</h1>
        <p className="mt-4">
          <Link to="/">Back to your arenas</Link>
        </p>
      </div>
    );
  }
  const { arena } = play;
  const byID = new Map(arena.candidates.map((issue) => [issue.id, issue]));
  const ranked = play.ranked.flatMap((rankedID) => byID.get(rankedID) ?? []);
  const complete = play.battle === null;

  const copy = async () => {
    await navigator.clipboard.writeText(toMarkdown(ranked));
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  };

  const undo = () => {
    play.undo();
    void navigate(`/arenas/${id}`);
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="font-mono text-xs tracking-wider text-gray-600 uppercase">
          {arena.scopeLabel}
        </p>
        <h1 className="text-3xl font-semibold">
          {complete
            ? `Your top ${ranked.length}`
            : `Top ${ranked.length} so far`}
        </h1>
      </div>

      <ol className="border-t border-gray-300">
        {ranked.map((issue: Issue, index) => (
          <li
            key={issue.id}
            className="flex items-baseline gap-4 border-b border-gray-300 py-4"
          >
            <span className="w-8 shrink-0 font-mono text-xl text-gray-500 tabular-nums">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <a
                href={issue.url}
                target="_blank"
                rel="noreferrer"
                className="font-semibold"
              >
                {issue.title}
              </a>
              <span className="flex items-center gap-2 font-mono text-xs text-gray-600">
                <StateIcon
                  type={issue.state.type}
                  name={issue.state.name}
                  className="size-3.5"
                />
                {issue.identifier} · {issue.state.name}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-3">
        <Button variant="primary" onClick={copy}>
          {copied ? (
            <CheckIcon className="size-4" aria-hidden="true" />
          ) : (
            <CopyIcon className="size-4" aria-hidden="true" />
          )}
          {copied ? 'Copied' : 'Copy as Markdown'}
        </Button>
        {complete ? (
          <Button onClick={undo} disabled={play.answered === 0}>
            Undo last battle
          </Button>
        ) : (
          <ButtonLink to={`/arenas/${id}`}>Keep playing</ButtonLink>
        )}
        <ButtonLink to="/">Back to your arenas</ButtonLink>
      </div>
    </div>
  );
}

/** `/arenas/:id/results`: the ranked top N, with links and a Markdown copy. */
export function ResultsPage() {
  const { id } = useParams();
  return id === undefined ? null : <Results key={id} id={id} />;
}
