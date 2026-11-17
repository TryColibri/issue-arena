import { useMemo } from 'react';

import { type Issue } from '@/shared/api';
import { type UseArenaResult } from '@/ui/arenas';
import { Button } from '@/ui/components/button';
import { IssueCard } from '@/ui/components/issue-card';
import { Kbd } from '@/ui/components/kbd';

import { sidesOf } from './battle-sides';
import { TopPanel } from './top-panel';
import { type Side, useBattleKeys } from './use-battle-keys';

/** Props of `Battle`. */
export type BattleProps = {
  /** The arena in play, with a battle pending. */
  play: UseArenaResult;
};

type PickProps = {
  /** The issue offered. */
  issue: Issue;
  /** Which side it is on. */
  side: Side;
  /** Whether the next key press drops instead of picks. */
  dropping: boolean;
  /** Called with the issue's ID when the user chooses it. */
  onChoose: (id: string) => void;
};

function Pick({ issue, side, dropping, onChoose }: PickProps) {
  const arrow = side === 'left' ? '←' : '→';
  return (
    <IssueCard
      issue={issue}
      aria-label={`${side === 'left' ? 'Left' : 'Right'} issue ${issue.identifier}`}
    >
      <Button
        variant={dropping ? 'danger' : 'primary'}
        className="w-full"
        onClick={() => {
          onChoose(issue.id);
        }}
      >
        {dropping ? 'Drop this issue' : 'This one is more important'}
        <Kbd className="bg-gray-0 text-gray-1000">{arrow}</Kbd>
      </Button>
    </IssueCard>
  );
}

/**
 * The battle screen: two issue cards, the progress, undo and drop, and the
 * live top list. All of it works from the keyboard.
 */
export function Battle({ play }: BattleProps) {
  const { arena, battle, ranked, answered, remaining } = play;
  const issues = useMemo(
    () => new Map((arena?.candidates ?? []).map((issue) => [issue.id, issue])),
    [arena],
  );
  const sides = battle === null ? null : sidesOf(battle);
  const left = sides === null ? undefined : issues.get(sides.left);
  const right = sides === null ? undefined : issues.get(sides.right);
  const top = ranked.flatMap((id) => issues.get(id) ?? []);

  const idOf = (side: Side): string | undefined =>
    side === 'left' ? sides?.left : sides?.right;

  const { dropping } = useBattleKeys({
    onPick: (side) => {
      const id = idOf(side);
      if (id !== undefined) {
        play.choose(id);
      }
    },
    onUndo: play.undo,
    onDrop: (side) => {
      const id = idOf(side);
      if (id !== undefined) {
        play.drop(id);
      }
    },
  });

  if (arena === null || left === undefined || right === undefined) {
    return null;
  }

  const total = answered + remaining;
  const progress = total === 0 ? 0 : Math.min(100, (answered / total) * 100);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-8 sm:px-6">
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="font-mono text-sm tabular-nums">
            Battle {answered + 1} · ~{remaining} left
          </p>
          <p className="flex items-center gap-4 text-xs text-gray-600">
            {play.syncStatus === 'failed' ? (
              <span className="flex items-center gap-1.5">
                <span className="size-2 bg-gray-1000" aria-hidden="true" />
                Not synced
              </span>
            ) : null}
            <span>{arena.scopeLabel}</span>
          </p>
        </div>
        <progress
          aria-label="Progress"
          max={100}
          value={Math.round(progress)}
          className="sr-only"
        />
        <div aria-hidden="true" className="h-1 bg-gray-200">
          <div
            className="h-full bg-gray-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {dropping ? (
        <output className="block border border-gray-1000 px-4 py-3 text-sm">
          Which one should not compete? Press <Kbd>←</Kbd> or <Kbd>→</Kbd>, or{' '}
          <Kbd>Esc</Kbd> to cancel.
        </output>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-stretch">
        <Pick
          issue={left}
          side="left"
          dropping={dropping}
          onChoose={dropping ? play.drop : play.choose}
        />
        <div className="flex items-center justify-center font-mono text-sm text-gray-600 lg:flex-col">
          vs
        </div>
        <Pick
          issue={right}
          side="right"
          dropping={dropping}
          onChoose={dropping ? play.drop : play.choose}
        />
      </div>

      <div className="flex flex-wrap items-center gap-6 text-sm text-gray-700">
        <span className="flex items-center gap-2">
          <Kbd>←</Kbd>
          <Kbd>→</Kbd> pick
        </span>
        <Button size="small" onClick={play.undo} disabled={answered === 0}>
          Undo <Kbd>U</Kbd>
        </Button>
        <span className="flex items-center gap-2">
          <Kbd>D</Kbd> then a side to drop
        </span>
      </div>

      <TopPanel n={arena.n} ranked={top} />
    </div>
  );
}
