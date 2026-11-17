import { createHash, randomBytes } from 'node:crypto';

import { z } from 'zod';

import { UnauthorizedError, UpstreamError } from '@/server/errors';

const AUTHORIZE_URL = 'https://linear.app/oauth/authorize';
const TOKEN_URL = 'https://api.linear.app/oauth/token';

/** Tokens Linear issued. */
export type LinearTokens = {
  /** Bearer token for the GraphQL API. */
  accessToken: string;
  /** Token that renews the access token, when Linear issued one. */
  refreshToken: string | null;
  /** When the access token expires, in epoch milliseconds. */
  expiresAt: number;
};

/** Fetch, injected so tests can mock the network. */
export type Fetch = typeof fetch;

/** The OAuth client of the Linear app. */
export type LinearOAuth = {
  /**
   * The URL to send the browser to.
   *
   * @param params - Redirect URI, anti-forgery state and PKCE challenge.
   */
  authorizeURL(params: AuthorizeParams): string;
  /**
   * Exchanges an authorization code for tokens.
   *
   * @param params - The code, PKCE verifier and the redirect URI used to start.
   * @throws {UnauthorizedError} When Linear rejects the code.
   */
  exchangeCode(params: ExchangeParams): Promise<LinearTokens>;
  /**
   * Renews tokens with a refresh token.
   *
   * @param refreshToken - The refresh token.
   * @throws {UnauthorizedError} When Linear rejects it.
   */
  refresh(refreshToken: string): Promise<LinearTokens>;
};

/** Inputs of `LinearOAuth.authorizeURL`. */
export type AuthorizeParams = {
  /** Where Linear sends the browser back. */
  redirectURI: string;
  /** Random value echoed back, to bind the callback to this browser. */
  state: string;
  /** PKCE S256 challenge. */
  challenge: string;
};

/** Inputs of `LinearOAuth.exchangeCode`. */
export type ExchangeParams = {
  /** The authorization code from the callback. */
  code: string;
  /** PKCE verifier matching the challenge. */
  verifier: string;
  /** The redirect URI used in the authorize step. */
  redirectURI: string;
};

/** Options of `createLinearOAuth`. */
export type LinearOAuthOptions = {
  /** Client ID of the Linear OAuth app. */
  clientID: string;
  /** Client secret of the Linear OAuth app. */
  clientSecret: string;
  /** Network access. */
  fetch: Fetch;
  /** Clock, in epoch milliseconds. Default: `Date.now`. */
  now?: () => number;
};

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().positive().optional(),
});

/** Access tokens without a stated lifetime are renewed after a day. */
const DEFAULT_LIFETIME_SECONDS = 24 * 60 * 60;

/**
 * Creates a PKCE pair: a random verifier and its S256 challenge.
 *
 * @returns The verifier to keep and the challenge to send.
 */
export function createPKCE(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

/** A random, URL-safe anti-forgery value. */
export function createState(): string {
  return randomBytes(16).toString('base64url');
}

/**
 * Creates the Linear OAuth client. It asks for the `read` scope only: the
 * app never writes to Linear.
 *
 * @param options - Credentials, network and clock.
 */
export function createLinearOAuth({
  clientID,
  clientSecret,
  fetch: request,
  now = Date.now,
}: LinearOAuthOptions): LinearOAuth {
  const requestTokens = async (
    form: Record<string, string>,
  ): Promise<LinearTokens> => {
    const response = await request(TOKEN_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientID,
        client_secret: clientSecret,
        ...form,
      }),
    });
    if (response.status >= 500) {
      throw new UpstreamError(`Linear answered ${response.status}.`);
    }
    if (!response.ok) {
      throw new UnauthorizedError('Linear refused the sign-in.');
    }
    const parsed = tokenResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new UpstreamError('Linear answered with an unexpected token.');
    }
    const lifetime = parsed.data.expires_in ?? DEFAULT_LIFETIME_SECONDS;
    return {
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token ?? null,
      expiresAt: now() + lifetime * 1000,
    };
  };

  return {
    authorizeURL({ redirectURI, state, challenge }) {
      const url = new URL(AUTHORIZE_URL);
      url.search = new URLSearchParams({
        client_id: clientID,
        redirect_uri: redirectURI,
        response_type: 'code',
        scope: 'read',
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
      }).toString();
      return url.toString();
    },
    async exchangeCode({ code, verifier, redirectURI }) {
      return requestTokens({
        grant_type: 'authorization_code',
        code,
        code_verifier: verifier,
        redirect_uri: redirectURI,
      });
    },
    async refresh(refreshToken) {
      return requestTokens({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      });
    },
  };
}
