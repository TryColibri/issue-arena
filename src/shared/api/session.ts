import { z } from 'zod';

/** The signed-in Linear user, as returned by `GET /api/v1/me`. */
export type Me = {
  /** Linear user ID. */
  id: string;
  /** Display name. */
  name: string;
  /** Avatar image URL, or `null` when the user has none. */
  avatarUrl: string | null;
  /** Linear workspace ID. */
  organizationId: string;
  /** Workspace name. */
  organizationName: string;
  /** Workspace URL key, as in `linear.app/<urlKey>`. */
  organizationUrlKey: string;
};

export const meSchema: z.ZodType<Me> = z.strictObject({
  id: z.string().describe('Linear user ID.'),
  name: z.string().describe('Display name.'),
  avatarUrl: z
    .string()
    .nullable()
    .describe('Avatar image URL, or `null` when the user has none.'),
  organizationId: z.string().describe('Linear workspace ID.'),
  organizationName: z.string().describe('Workspace name.'),
  organizationUrlKey: z
    .string()
    .describe('Workspace URL key, as in `linear.app/<urlKey>`.'),
});
