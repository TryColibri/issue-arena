import { type ClientRequestOptions, hc } from 'hono/client';

import type { ApiV1 } from '@/server/api';

/**
 * Creates a typed client for Issue Arena's REST API (`/api/v1`).
 *
 * @param baseUrl - Origin of the server, or `''` for same-origin requests
 * from the SPA.
 * @param options - Extra `hc` options (custom `fetch`, headers, …).
 */
export function createIssueArenaClient(
  baseUrl: string,
  options?: ClientRequestOptions,
) {
  return hc<ApiV1>(`${baseUrl}/api/v1`, options);
}

/** A typed client for Issue Arena's REST API. */
export type IssueArenaClient = ReturnType<typeof createIssueArenaClient>;
