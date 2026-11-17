import { useEffect, useState } from 'react';

/** Which side of the screen. */
export type Side = 'left' | 'right';

/** What the keys do. */
export type BattleKeyHandlers = {
  /**
   * `←` or `→`: pick a side.
   *
   * @param side - The side picked.
   */
  onPick: (side: Side) => void;
  /** `U`: undo the last answer. */
  onUndo: () => void;
  /**
   * `D`, then `←` or `→`: drop the issue on that side.
   *
   * @param side - The side to drop.
   */
  onDrop: (side: Side) => void;
};

/** Whether a key event comes from somewhere the user is typing. */
const typing = (target: EventTarget | null): boolean =>
  target instanceof HTMLElement &&
  (target.isContentEditable ||
    ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

/**
 * The battle screen's keyboard: `←`/`→` to pick, `U` to undo, `D` then a side
 * to drop (`Esc` or `D` again cancels). Ignored while typing or with a
 * modifier held.
 *
 * @param handlers - What each key does.
 * @returns Whether a drop is waiting for a side.
 */
export function useBattleKeys({ onPick, onUndo, onDrop }: BattleKeyHandlers): {
  dropping: boolean;
} {
  const [dropping, setDropping] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        typing(event.target) ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const side: Side | null =
        event.key === 'ArrowLeft'
          ? 'left'
          : event.key === 'ArrowRight'
            ? 'right'
            : null;
      if (side !== null) {
        event.preventDefault();
        setDropping(false);
        (dropping ? onDrop : onPick)(side);
      } else if (event.key === 'u' || event.key === 'U') {
        setDropping(false);
        onUndo();
      } else if (event.key === 'd' || event.key === 'D') {
        setDropping((current) => !current);
      } else if (event.key === 'Escape') {
        setDropping(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [dropping, onPick, onUndo, onDrop]);

  return { dropping };
}
