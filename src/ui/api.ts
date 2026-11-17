import useSWR, { type SWRResponse } from 'swr';

import {
  type ArenaSummary,
  type FieldError,
  type IssueSearchResponse,
  type Me,
  type Option,
  type Problem,
  problemSchema,
  type Scope,
} from '@/shared/api';
import { createIssueArenaClient } from '@/shared/client';

/** The typed API client. Same origin: Vite proxies `/api` in development. */
export const client = createIssueArenaClient('');

/** A failed API call, carrying the parsed problem details. */
export class ApiError extends Error {
  override name = 'ApiError';

  /** The problem details returned by the API. */
  readonly problem: Problem;

  /** @param problem - The problem details returned by the API. */
  constructor(problem: Problem) {
    super(problem.detail);
    this.problem = problem;
  }

  /** HTTP status code. */
  get status(): number {
    return this.problem.status;
  }

  /** Field-level errors, keyed by dotted path. */
  get fieldErrors(): Partial<Record<string, string>> {
    return Object.fromEntries(
      (this.problem.errors ?? []).map((error: FieldError) => [
        error.path,
        error.message,
      ]),
    );
  }
}

type JSONResponse<T> = {
  ok: boolean;
  status: number;
  statusText: string;
  json(): Promise<T>;
};

const toApiError = async (response: JSONResponse<unknown>) => {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const parsed = problemSchema.safeParse(body);
  return new ApiError(
    parsed.success
      ? parsed.data
      : {
          type: 'about:blank',
          title: response.statusText,
          status: response.status,
          detail: `Request failed with status ${response.status}`,
        },
  );
};

/**
 * Awaits a typed client call and returns its JSON body.
 *
 * @param request - A call on `client`.
 * @throws {ApiError} When the response is not 2xx.
 */
export async function unwrap<T>(request: Promise<JSONResponse<T>>): Promise<T> {
  const response = await request;
  if (!response.ok) {
    throw await toApiError(response);
  }
  return response.json();
}

/**
 * Awaits a typed client call that answers 204.
 *
 * @param request - A call on `client`.
 * @throws {ApiError} When the response is not 2xx.
 */
export async function unwrapEmpty(
  request: Promise<JSONResponse<unknown>>,
): Promise<void> {
  const response = await request;
  if (!response.ok) {
    throw await toApiError(response);
  }
}

/** SWR keys, so mutations can revalidate what they change. */
export const keys = {
  me: 'me',
  arenas: 'arenas',
  picker: (kind: PickerKind) => `picker/${kind}`,
  issues: (scope: Scope) => ['issues', JSON.stringify(scope)] as const,
} as const;

/** The lists a scope or filter picker can load. */
export type PickerKind =
  | 'teams'
  | 'projects'
  | 'initiatives'
  | 'users'
  | 'labels'
  | 'states'
  | 'cycles';

/**
 * `GET /api/v1/me`. A 401 means signed out. It is also what renews an expired
 * Linear token, so everything else should wait for it to succeed: two
 * requests racing to renew the same refresh token can invalidate each other.
 */
export function useMe() {
  return useSWR<Me, ApiError>(keys.me, async () => unwrap(client.me.$get()), {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
  });
}

/** `GET /api/v1/arenas`: the signed-in user's arenas. */
export function useArenas() {
  return useSWR<ArenaSummary[], ApiError>(
    keys.arenas,
    async () => (await unwrap(client.arenas.$get())).items,
  );
}

/** The `Option` loaders, one per picker endpoint. */
const pickerLoaders: Record<PickerKind, () => Promise<{ items: Option[] }>> = {
  teams: async () => unwrap(client.teams.$get()),
  projects: async () => unwrap(client.projects.$get()),
  initiatives: async () => unwrap(client.initiatives.$get()),
  users: async () => unwrap(client.users.$get()),
  labels: async () => unwrap(client.labels.$get()),
  states: async () => unwrap(client.states.$get()),
  cycles: async () => unwrap(client.cycles.$get()),
};

/**
 * A picker list. Pass `null` as `kind` to fetch nothing.
 *
 * @param kind - Which list, e.g. `projects`.
 */
export function useOptions(kind: PickerKind | null) {
  return useSWR<Option[], ApiError>(
    kind === null ? null : keys.picker(kind),
    async () => (kind === null ? [] : (await pickerLoaders[kind]()).items),
    { revalidateOnFocus: false },
  );
}

/**
 * `POST /api/v1/issues/search`. Pass `null` as `scope` to fetch nothing.
 *
 * @param scope - Which issues, or `null`.
 */
export function useIssueSearch(
  scope: Scope | null,
): SWRResponse<IssueSearchResponse, ApiError> {
  return useSWR<IssueSearchResponse, ApiError>(
    scope === null ? null : keys.issues(scope),
    async () =>
      scope === null
        ? { items: [], truncated: false }
        : unwrap(client.issues.search.$post({ json: { scope } })),
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
}
