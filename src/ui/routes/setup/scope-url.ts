import { type Scope, scopeSchema } from '@/shared/api';

/** The setup route's path. */
export const SETUP_PATH = '/setup';

/**
 * The setup URL for a scope. The scope travels in the query string as JSON,
 * so a custom filter survives a reload and can be shared.
 *
 * @param scope - The scope to rank.
 * @param label - What the scope is called, e.g. `Project: Billing`.
 */
export function setupURL(scope: Scope, label: string): string {
  const params = new URLSearchParams({
    scope: JSON.stringify(scope),
    label,
  });
  return `${SETUP_PATH}?${params.toString()}`;
}

/** What `parseSetupParams` found. */
export type SetupParams = {
  /** The scope, validated. */
  scope: Scope;
  /** The scope's display name. */
  label: string;
};

/**
 * Reads the scope back out of the setup URL's query string.
 *
 * @param params - The query string.
 * @returns The scope and its label, or `null` when the scope is missing or invalid.
 */
export function parseSetupParams(params: URLSearchParams): SetupParams | null {
  const raw = params.get('scope');
  if (raw === null) {
    return null;
  }
  try {
    const scope = scopeSchema.safeParse(JSON.parse(raw));
    return scope.success
      ? { scope: scope.data, label: params.get('label') ?? 'Issues' }
      : null;
  } catch {
    return null;
  }
}
