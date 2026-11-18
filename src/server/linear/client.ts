import { z } from 'zod';

import { UnauthorizedError, UpstreamError } from '@/server/errors';
import {
  type Issue,
  type IssueSearchResponse,
  MAX_SEARCH_ISSUES,
  type Me,
  type Option,
  type Scope,
  stateTypeSchema,
} from '@/shared/api';

import { compileScope } from './compile-filter';
import { toExcerpt } from './excerpt';

const GRAPHQL_URL = 'https://api.linear.app/graphql';

/** Page size of every Linear list query. */
const PAGE_SIZE = 100;

/** Pages fetched for a picker: Linear workspaces rarely exceed this. */
const MAX_PICKER_PAGES = 5;

/** Which picker list to fetch. */
export type OptionKind =
  | 'teams'
  | 'projects'
  | 'initiatives'
  | 'users'
  | 'labels'
  | 'states'
  | 'cycles';

/** Everything the server reads from Linear. Each call carries the user's token. */
export type LinearClient = {
  /**
   * The user the token belongs to.
   *
   * @param token - Linear access token.
   * @throws {UnauthorizedError} When Linear rejects the token.
   */
  viewer(token: string): Promise<Me>;
  /**
   * The choices of a picker, sorted by name.
   *
   * @param token - Linear access token.
   * @param kind - Which list.
   */
  options(token: string, kind: OptionKind): Promise<Option[]>;
  /**
   * Issues in a scope, at most `MAX_SEARCH_ISSUES`.
   *
   * @param token - Linear access token.
   * @param scope - Which issues.
   */
  searchIssues(token: string, scope: Scope): Promise<IssueSearchResponse>;
};

/** Options of `createLinearClient`. */
export type LinearClientOptions = {
  /** Network access. */
  fetch: typeof fetch;
};

const pageInfoSchema = z.object({
  hasNextPage: z.boolean(),
  endCursor: z.string().nullable(),
});

const connection = <T extends z.ZodType>(node: T) =>
  z.object({ nodes: z.array(node), pageInfo: pageInfoSchema });

const viewerSchema = z.object({
  viewer: z.object({
    id: z.string(),
    name: z.string(),
    avatarUrl: z.string().nullable(),
    organization: z.object({
      id: z.string(),
      name: z.string(),
      urlKey: z.string(),
    }),
  }),
});

const issueNodeSchema = z.object({
  id: z.string(),
  identifier: z.string(),
  title: z.string(),
  url: z.string(),
  priority: z.number(),
  priorityLabel: z.string(),
  sortOrder: z.number(),
  state: z.object({ name: z.string(), type: stateTypeSchema }),
  team: z.object({ key: z.string() }),
  assignee: z
    .object({ name: z.string(), avatarUrl: z.string().nullable() })
    .nullable(),
  project: z.object({ name: z.string() }).nullable(),
  labels: z.object({ nodes: z.array(z.object({ name: z.string() })) }),
  inverseRelations: z.object({
    nodes: z.array(
      z.object({
        type: z.string(),
        issue: z.object({ state: z.object({ type: stateTypeSchema }) }),
      }),
    ),
  }),
  estimate: z.number().nullable(),
  dueDate: z.string().nullable(),
  description: z.string().nullable(),
});

const issuesQuery = `
  query Issues($filter: IssueFilter, $after: String, $first: Int!) {
    issues(filter: $filter, after: $after, first: $first) {
      nodes {
        id identifier title url priority priorityLabel sortOrder
        state { name type }
        team { key }
        assignee { name avatarUrl }
        project { name }
        labels(first: 20) { nodes { name } }
        inverseRelations(first: 25) { nodes { type issue { state { type } } } }
        estimate dueDate description
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

const viewerQuery = `
  query Viewer {
    viewer { id name avatarUrl organization { id name urlKey } }
  }
`;

const nodeID = z.object({ id: z.string(), name: z.string() });
const withTeam = z.object({ key: z.string() });

type PickerDefinition<T extends z.ZodType> = {
  /** The root field to query. */
  field: string;
  /** Fields of one node. */
  select: string;
  /** Extra arguments of the root field. */
  args?: string;
  /** Shape of one node. */
  node: T;
  /** Maps a node to a choice. */
  toOption: (node: z.infer<T>) => Option;
};

/** A picker query, with its response already mapped to choices. */
type Picker = {
  field: string;
  select: string;
  args: string;
  page: z.ZodType<{
    nodes: Option[];
    pageInfo: z.infer<typeof pageInfoSchema>;
  }>;
};

const picker = <T extends z.ZodType>({
  field,
  select,
  args = '',
  node,
  toOption,
}: PickerDefinition<T>): Picker => ({
  field,
  select,
  args,
  page: connection(node).transform((page) => ({
    nodes: page.nodes.map(toOption),
    pageInfo: page.pageInfo,
  })),
});

const pickers: Record<OptionKind, Picker> = {
  teams: picker({
    field: 'teams',
    select: 'id name key',
    node: nodeID.extend({ key: z.string() }),
    toOption: (node) => ({ id: node.id, name: node.name, hint: node.key }),
  }),
  projects: picker({
    field: 'projects',
    select: 'id name',
    node: nodeID,
    toOption: (node) => ({ id: node.id, name: node.name, hint: null }),
  }),
  initiatives: picker({
    field: 'initiatives',
    select: 'id name',
    node: nodeID,
    toOption: (node) => ({ id: node.id, name: node.name, hint: null }),
  }),
  users: picker({
    field: 'users',
    args: ', filter: { active: { eq: true } }',
    select: 'id name',
    node: nodeID,
    toOption: (node) => ({ id: node.id, name: node.name, hint: null }),
  }),
  labels: picker({
    field: 'issueLabels',
    select: 'id name team { key }',
    node: nodeID.extend({ team: withTeam.nullable() }),
    toOption: (node) => ({
      id: node.id,
      name: node.name,
      hint: node.team?.key ?? null,
    }),
  }),
  states: picker({
    field: 'workflowStates',
    select: 'id name team { key }',
    node: nodeID.extend({ team: withTeam }),
    toOption: (node) => ({ id: node.id, name: node.name, hint: node.team.key }),
  }),
  cycles: picker({
    field: 'cycles',
    args: ', filter: { isActive: { eq: true } }',
    select: 'id name number team { key }',
    node: z.object({
      id: z.string(),
      name: z.string().nullable(),
      number: z.number(),
      team: withTeam,
    }),
    toOption: (node) => ({
      id: node.id,
      name: node.name ?? `Cycle ${node.number}`,
      hint: node.team.key,
    }),
  }),
};

/** Whether a relation says that an issue still open blocks this one. */
const isOpenBlocker = ({
  type,
  issue,
}: z.infer<typeof issueNodeSchema>['inverseRelations']['nodes'][number]) =>
  type === 'blocks' &&
  issue.state.type !== 'completed' &&
  issue.state.type !== 'canceled';

const toIssue = (node: z.infer<typeof issueNodeSchema>): Issue => ({
  id: node.id,
  identifier: node.identifier,
  title: node.title,
  url: node.url,
  priority: Math.min(4, Math.max(0, Math.round(node.priority))),
  priorityLabel: node.priorityLabel,
  sortOrder: node.sortOrder,
  state: node.state,
  teamKey: node.team.key,
  assignee: node.assignee,
  projectName: node.project?.name ?? null,
  labels: node.labels.nodes.map((label) => label.name),
  blocked: node.inverseRelations.nodes.some(isOpenBlocker),
  estimate: node.estimate,
  dueDate: node.dueDate,
  excerpt: toExcerpt(node.description),
});

/**
 * Creates the Linear client: GraphQL over `fetch`, every response parsed with
 * Zod. Linear's `read` scope is all it needs.
 *
 * @param options - Network access.
 */
export function createLinearClient({
  fetch: request,
}: LinearClientOptions): LinearClient {
  const run = async <T extends z.ZodType>(
    token: string,
    query: string,
    variables: Record<string, unknown>,
    schema: T,
  ): Promise<z.infer<T>> => {
    const response = await request(GRAPHQL_URL, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });
    if (response.status === 401) {
      throw new UnauthorizedError('Linear rejected the access token.');
    }
    const body: unknown = await response.json().catch(() => null);
    const envelope = z
      .object({
        data: z.unknown().optional(),
        errors: z
          .array(
            z.object({
              message: z.string(),
              extensions: z.object({ type: z.string().optional() }).optional(),
            }),
          )
          .optional(),
      })
      .safeParse(body);
    if (!envelope.success) {
      throw new UpstreamError(`Linear answered ${response.status}.`);
    }
    const errors = envelope.data.errors ?? [];
    if (
      errors.some((error) => error.extensions?.type === 'authentication error')
    ) {
      throw new UnauthorizedError('Linear rejected the access token.');
    }
    if (errors.length > 0 || !response.ok) {
      throw new UpstreamError(
        errors.at(0)?.message ?? `Linear answered ${response.status}.`,
      );
    }
    const data = schema.safeParse(envelope.data.data);
    if (!data.success) {
      throw new UpstreamError('Linear answered with an unexpected shape.');
    }
    return data.data;
  };

  const viewer: LinearClient['viewer'] = async (token) => {
    const { viewer: user } = await run(token, viewerQuery, {}, viewerSchema);
    return {
      id: user.id,
      name: user.name,
      avatarUrl: user.avatarUrl,
      organizationId: user.organization.id,
      organizationName: user.organization.name,
      organizationUrlKey: user.organization.urlKey,
    };
  };

  const options: LinearClient['options'] = async (token, kind) => {
    const definition = pickers[kind];
    const query = `
      query Picker($after: String) {
        ${definition.field}(first: ${PAGE_SIZE}, after: $after${definition.args}) {
          nodes { ${definition.select} }
          pageInfo { hasNextPage endCursor }
        }
      }
    `;
    const schema = z.record(z.string(), definition.page);
    const items: Option[] = [];
    let after: string | null = null;
    for (let page = 0; page < MAX_PICKER_PAGES; page += 1) {
      const data: z.infer<typeof schema> = await run(
        token,
        query,
        { after },
        schema,
      );
      const list = Object.entries(data).find(
        ([field]) => field === definition.field,
      )?.[1];
      if (list === undefined) {
        throw new UpstreamError('Linear answered with an unexpected shape.');
      }
      items.push(...list.nodes);
      if (!list.pageInfo.hasNextPage) {
        break;
      }
      after = list.pageInfo.endCursor;
    }
    return items.toSorted((x, y) => x.name.localeCompare(y.name));
  };

  const searchIssues: LinearClient['searchIssues'] = async (token, scope) => {
    const filter = compileScope(scope);
    const schema = z.object({ issues: connection(issueNodeSchema) });
    const items: Issue[] = [];
    let after: string | null = null;
    let more = true;
    while (more && items.length < MAX_SEARCH_ISSUES) {
      const page: z.infer<typeof schema> = await run(
        token,
        issuesQuery,
        { filter, after, first: PAGE_SIZE },
        schema,
      );
      const { issues } = page;
      items.push(...issues.nodes.map(toIssue));
      more = issues.pageInfo.hasNextPage;
      after = issues.pageInfo.endCursor;
    }
    return { items: items.slice(0, MAX_SEARCH_ISSUES), truncated: more };
  };

  return { viewer, options, searchIssues };
}
