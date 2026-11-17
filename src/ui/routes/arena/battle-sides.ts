import { type Battle } from '@/shared/arena';

/** Which issue is shown on which side of the screen. */
export type Sides = {
  /** ID of the issue on the left, picked with `←`. */
  left: string;
  /** ID of the issue on the right, picked with `→`. */
  right: string;
};

/**
 * Decides which side each issue of a battle is shown on. The candidate always
 * comes first in a battle, so showing it on a fixed side would bias the picks.
 * The choice is a hash of the two IDs: random-looking, but the same after a
 * reload or an undo.
 *
 * @param battle - The battle to show.
 */
export function sidesOf({ a, b }: Battle): Sides {
  let hash = 0;
  for (const char of `${a}|${b}`) {
    hash = (hash * 31 + (char.codePointAt(0) ?? 0)) % 1_000_003;
  }
  return hash % 2 === 0 ? { left: a, right: b } : { left: b, right: a };
}
