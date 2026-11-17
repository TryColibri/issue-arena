import { Hono } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { type LinearClient } from '@/server/linear';

import { createPKCE, createState, type LinearOAuth } from './linear-oauth';
import { createSealer } from './sealed';
import { type SessionGate, secureRequest } from './session';

const OAUTH_COOKIE = 'ia_oauth';
const OAUTH_TTL_SECONDS = 10 * 60;
const CALLBACK_PATH = '/api/auth/linear/callback';

const attemptSchema = z.strictObject({
  verifier: z.string(),
  state: z.string(),
});

/** Options of `createAuthRoutes`. */
export type AuthRoutesOptions = {
  /** Secret sealing the short-lived PKCE cookie. */
  secret: string;
  /** The Linear OAuth client. */
  oauth: LinearOAuth;
  /** Linear API, to learn who signed in. */
  linear: LinearClient;
  /** The session gate, which stores the session. */
  sessions: SessionGate;
  /** Workspace IDs allowed to sign in. Empty allows every workspace. */
  allowedOrgIDs: string[];
};

/**
 * `/api/auth`: the Linear OAuth round trip with PKCE and `state`, and logout.
 * The two OAuth routes are top-level navigations, so failures redirect to
 * `/?error=<code>` for the SPA to explain instead of answering JSON.
 *
 * @param options - Secret, OAuth client, Linear client, session gate and allow-list.
 */
export function createAuthRoutes({
  secret,
  oauth,
  linear,
  sessions,
  allowedOrgIDs,
}: AuthRoutesOptions) {
  const attempts = createSealer(secret, 'oauth-attempt', attemptSchema);
  const redirectURI = (requestURL: string) =>
    `${new URL(requestURL).origin}${CALLBACK_PATH}`;

  return new Hono()
    .get('/linear/start', async (c) => {
      const { verifier, challenge } = createPKCE();
      const state = createState();
      setCookie(
        c,
        OAUTH_COOKIE,
        await attempts.seal({ verifier, state }, OAUTH_TTL_SECONDS),
        {
          httpOnly: true,
          secure: secureRequest(c),
          sameSite: 'Lax',
          path: '/api/auth',
          maxAge: OAUTH_TTL_SECONDS,
        },
      );
      return c.redirect(
        oauth.authorizeURL({
          redirectURI: redirectURI(c.req.url),
          state,
          challenge,
        }),
      );
    })
    .get('/linear/callback', async (c) => {
      const cookie = getCookie(c, OAUTH_COOKIE);
      deleteCookie(c, OAUTH_COOKIE, {
        path: '/api/auth',
        secure: secureRequest(c),
      });
      const attempt = cookie === undefined ? null : await attempts.open(cookie);
      const code = c.req.query('code');
      if (c.req.query('error') !== undefined || code === undefined) {
        return c.redirect('/?error=denied');
      }
      if (attempt === null || attempt.state !== c.req.query('state')) {
        return c.redirect('/?error=state');
      }
      try {
        const tokens = await oauth.exchangeCode({
          code,
          verifier: attempt.verifier,
          redirectURI: redirectURI(c.req.url),
        });
        const me = await linear.viewer(tokens.accessToken);
        if (
          allowedOrgIDs.length > 0 &&
          !allowedOrgIDs.includes(me.organizationId)
        ) {
          return c.redirect('/?error=workspace');
        }
        await sessions.start(c, { ...tokens, me });
      } catch {
        return c.redirect('/?error=failed');
      }
      return c.redirect('/');
    })
    .post('/logout', (c) => {
      sessions.end(c);
      return c.body(null, 204);
    });
}
