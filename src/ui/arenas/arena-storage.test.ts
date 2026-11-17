import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  readLocalArena,
  reconcile,
  removeLocalArena,
  writeLocalArena,
} from './arena-storage';
import { TEST_ARENA_ID, testArena } from './test-arena';

describe('arena storage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  describe('writeLocalArena and readLocalArena', () => {
    it('round-trips an arena under issue-arena:arena:<id>', () => {
      writeLocalArena(testArena());
      expect(
        localStorage.getItem(`issue-arena:arena:${TEST_ARENA_ID}`),
      ).not.toBeNull();
      expect(readLocalArena(TEST_ARENA_ID)).toEqual(testArena());
    });

    it('returns null when there is nothing stored', () => {
      expect(readLocalArena(TEST_ARENA_ID)).toBeNull();
    });

    it('returns null for corrupt or outdated values', () => {
      localStorage.setItem(`issue-arena:arena:${TEST_ARENA_ID}`, '{not json');
      expect(readLocalArena(TEST_ARENA_ID)).toBeNull();
      localStorage.setItem(`issue-arena:arena:${TEST_ARENA_ID}`, '{"id":1}');
      expect(readLocalArena(TEST_ARENA_ID)).toBeNull();
    });

    it('does not throw when storage is blocked', () => {
      vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('blocked');
      });
      expect(() => {
        writeLocalArena(testArena());
      }).not.toThrow();
      expect(readLocalArena(TEST_ARENA_ID)).toBeNull();
    });
  });

  describe('removeLocalArena', () => {
    it('removes the stored arena', () => {
      writeLocalArena(testArena());
      removeLocalArena(TEST_ARENA_ID);
      expect(readLocalArena(TEST_ARENA_ID)).toBeNull();
    });
  });

  describe('reconcile', () => {
    const local = testArena({ revision: 3 });

    it('keeps whichever has the higher revision', () => {
      const remote = testArena({ revision: 5 });
      expect(reconcile(local, remote)).toEqual({
        arena: remote,
        fromRemote: true,
      });
      expect(reconcile(remote, local)).toEqual({
        arena: remote,
        fromRemote: false,
      });
    });

    it('keeps the local copy on a tie', () => {
      expect(reconcile(local, testArena({ revision: 3 }))).toEqual({
        arena: local,
        fromRemote: false,
      });
    });

    it('uses whichever exists', () => {
      expect(reconcile(local, null)).toEqual({
        arena: local,
        fromRemote: false,
      });
      expect(reconcile(null, local)).toEqual({
        arena: local,
        fromRemote: true,
      });
    });

    it('is null with neither', () => {
      expect(reconcile(null, null)).toBeNull();
    });
  });
});
