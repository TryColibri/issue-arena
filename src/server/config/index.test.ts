import { describe, expect, it } from 'vitest';

import { parseConfig } from './index';

const env = {
  LINEAR_CLIENT_ID: 'id',
  LINEAR_CLIENT_SECRET: 'secret',
  SESSION_SECRET: 'x'.repeat(32),
};

describe('parseConfig', () => {
  it('parses the required variables', () => {
    expect(parseConfig(env)).toEqual({
      linearClientID: 'id',
      linearClientSecret: 'secret',
      sessionSecret: 'x'.repeat(32),
      allowedOrgIDs: [],
    });
  });

  it('splits the allowed workspaces on commas', () => {
    expect(
      parseConfig({ ...env, ALLOWED_LINEAR_ORG_IDS: 'a, b ,,c' }).allowedOrgIDs,
    ).toEqual(['a', 'b', 'c']);
  });

  it('names every missing variable', () => {
    expect(() => parseConfig({})).toThrow(/LINEAR_CLIENT_ID/);
    expect(() => parseConfig({})).toThrow(/SESSION_SECRET/);
  });

  it('rejects a short session secret', () => {
    expect(() => parseConfig({ ...env, SESSION_SECRET: 'short' })).toThrow(
      /SESSION_SECRET/,
    );
  });
});
