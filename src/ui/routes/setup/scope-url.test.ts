import { describe, expect, it } from 'vitest';

import { type Scope } from '@/shared/api';

import { parseSetupParams, setupURL } from './scope-url';

const query = (url: string) => new URL(url, 'https://x.test').searchParams;

describe('setupURL and parseSetupParams', () => {
  it.each<Scope>([
    { type: 'my' },
    { type: 'project', projectId: 'p1' },
    {
      type: 'custom',
      filter: {
        match: 'any',
        conditions: [{ field: 'priority', operator: 'is', values: [1, 2] }],
      },
    },
  ])('round-trips %j', (scope) => {
    expect(parseSetupParams(query(setupURL(scope, 'A & B?')))).toEqual({
      scope,
      label: 'A & B?',
    });
  });

  it('rejects a missing scope', () => {
    expect(parseSetupParams(new URLSearchParams())).toBeNull();
  });

  it('rejects malformed JSON', () => {
    expect(
      parseSetupParams(new URLSearchParams({ scope: '{nope' })),
    ).toBeNull();
  });

  it('rejects a scope that fails the schema', () => {
    expect(
      parseSetupParams(new URLSearchParams({ scope: '{"type":"project"}' })),
    ).toBeNull();
  });
});
