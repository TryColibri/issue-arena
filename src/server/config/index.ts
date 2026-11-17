import { z } from 'zod';

/** Server configuration, parsed from the environment. */
export type Config = {
  /** Client ID of the Linear OAuth app. */
  linearClientID: string;
  /** Client secret of the Linear OAuth app. */
  linearClientSecret: string;
  /** Secret that seals session cookies, at least 32 characters. */
  sessionSecret: string;
  /** Linear workspace IDs allowed to sign in. Empty allows every workspace. */
  allowedOrgIDs: string[];
};

const envSchema = z.object({
  LINEAR_CLIENT_ID: z.string().min(1),
  LINEAR_CLIENT_SECRET: z.string().min(1),
  SESSION_SECRET: z.string().min(32, 'Use at least 32 characters.'),
  ALLOWED_LINEAR_ORG_IDS: z.string().optional(),
});

/**
 * Parses the environment into a `Config`.
 *
 * @param env - Environment variables, e.g. `process.env`.
 * @throws {Error} Naming every missing or invalid variable.
 */
export function parseConfig(env: Record<string, string | undefined>): Config {
  const result = envSchema.safeParse(env);
  if (!result.success) {
    const problems = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment: ${problems}`);
  }
  return {
    linearClientID: result.data.LINEAR_CLIENT_ID,
    linearClientSecret: result.data.LINEAR_CLIENT_SECRET,
    sessionSecret: result.data.SESSION_SECRET,
    allowedOrgIDs: (result.data.ALLOWED_LINEAR_ORG_IDS ?? '')
      .split(',')
      .map((id) => id.trim())
      .filter((id) => id !== ''),
  };
}
