import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { createSealer } from './sealed';

const schema = z.object({ name: z.string() });
const secret = 's'.repeat(32);

describe('createSealer', () => {
  it('opens what it sealed', async () => {
    const sealer = createSealer(secret, 'test', schema);
    const token = await sealer.seal({ name: 'ada' }, 60);
    expect(await sealer.open(token)).toEqual({ name: 'ada' });
  });

  it('does not leak the value', async () => {
    const token = await createSealer(secret, 'test', schema).seal(
      { name: 'ada-lovelace' },
      60,
    );
    expect(token).not.toContain('ada');
    expect(
      Buffer.from(token.split('.')[3] ?? '', 'base64url').toString(),
    ).not.toContain('ada');
  });

  it('rejects a tampered token', async () => {
    const sealer = createSealer(secret, 'test', schema);
    const token = await sealer.seal({ name: 'ada' }, 60);
    expect(await sealer.open(`${token.slice(0, -2)}xx`)).toBeNull();
  });

  it('rejects garbage', async () => {
    expect(await createSealer(secret, 'test', schema).open('nope')).toBeNull();
  });

  it('rejects a token from another secret or purpose', async () => {
    const token = await createSealer(secret, 'a', schema).seal(
      { name: 'x' },
      60,
    );
    expect(
      await createSealer('t'.repeat(32), 'a', schema).open(token),
    ).toBeNull();
    expect(await createSealer(secret, 'b', schema).open(token)).toBeNull();
  });

  it('rejects an expired token', async () => {
    const sealer = createSealer(secret, 'test', schema);
    const token = await sealer.seal({ name: 'ada' }, -10);
    expect(await sealer.open(token)).toBeNull();
  });

  it('rejects a value of the wrong shape', async () => {
    const loose = createSealer(secret, 'test', z.object({ other: z.number() }));
    const token = await loose.seal({ other: 1 }, 60);
    expect(await createSealer(secret, 'test', schema).open(token)).toBeNull();
  });
});
