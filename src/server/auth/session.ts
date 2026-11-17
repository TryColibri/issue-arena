import { type Context, type MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';

import { UnauthorizedError } from '@/server/errors';
import { type Me, meSchema, PROBLEM_TYPES, problemSchema } from '@/shared/api';

import { type LinearOAuth } from './linear-oauth';
import { createSealer, type Sealer } from './sealed';

/** What the encrypted session cookie holds. */
export type Session = {
  /** Linear access token. */
  accessToken: string;
  /** Linear refresh token, when Linear issued one. */
  refreshToken: string | null;
  /** When the access token expires, in epoch milliseconds. */
  expiresAt: number;
  /** The signed-in user and workspace. */
  me: Me;
};

/** Hono environment of every route behind the session gate. */
export type AuthEnv = {
  Variables: {
    /** The verified session, set by `SessionGate.require`. */
    session: Session;
  };
};

const sessionSchema: z.ZodType<Session> = z.strictObject({
  accessToken: z.string(),
  refreshToken: z.string().nullable(),
  expiresAt: z.number(),
  me: meSchema,
});

/** Name of the session cookie. */
export const SESSION_COOKIE = 'ia_session';

/** A session with a refresh token lasts this long. */
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/** Access tokens are renewed this long before they expire. */
const REFRESH_SKEW_MS = 60_000;

/** Linear IDs are UUIDs. They end up in blob pathnames, so nothing else gets in. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,100}$/;

/** Options of `createSessionGate`. */
export type SessionGateOptions = {
  /** Secret sealing the cookie. */
  secret: string;
  /** Renews expired access tokens. */
  oauth: LinearOAuth;
  /** Clock, in epoch milliseconds. Default: `Date.now`. */
  now?: () => number;
};

/** Reads, renews and writes the session cookie. */
export type SessionGate = {
  /** Middleware: answers 401 unless the request has a valid session, renewing it when needed. */
  require: MiddlewareHandler<AuthEnv>;
  /**
   * Starts a session: writes the cookie.
   *
   * @param c - The request context, whose response gets the cookie.
   * @param session - The session to store.
   */
  start(c: Context, session: Session): Promise<void>;
  /**
   * Ends the session: clears the cookie.
   *
   * @param c - The request context.
   */
  end(c: Context): void;
};

/** Whether a request was made over HTTPS. `Secure` cookies are skipped on plain-HTTP localhost. */
export const secureRequest = (c: Context): boolean =>
  new URL(c.req.url).protocol === 'https:';

/**
 * Creates the session gate. The cookie is `HttpOnly; SameSite=Lax`, and
 * `Secure` over HTTPS, and holds the Linear tokens encrypted with
 * `A256GCM`. Because Linear may rotate refresh tokens, the SPA should load
 * `/api/v1/me` before it fires anything else: that request does the renewal.
 *
 * @param options - Secret, OAuth client and clock.
 */
export function createSessionGate({
  secret,
  oauth,
  now = Date.now,
}: SessionGateOptions): SessionGate {
  const sealer: Sealer<Session> = createSealer(
    secret,
    'session',
    sessionSchema,
  );

  const write = async (c: Context, session: Session): Promise<void> => {
    if (
      !SAFE_ID.test(session.me.id) ||
      !SAFE_ID.test(session.me.organizationId)
    ) {
      throw new UnauthorizedError('Linear returned an unexpected identity.');
    }
    const ttl =
      session.refreshToken === null
        ? Math.max(60, Math.floor((session.expiresAt - now()) / 1000))
        : SESSION_TTL_SECONDS;
    setCookie(c, SESSION_COOKIE, await sealer.seal(session, ttl), {
      httpOnly: true,
      secure: secureRequest(c),
      sameSite: 'Lax',
      path: '/',
      maxAge: ttl,
    });
  };

  const end = (c: Context): void => {
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure: secureRequest(c) });
  };

  // Answers 401 itself instead of throwing: a response built by the error
  // handler would not carry the cookie that clears the dead session.
  const reject = (c: Context, detail: string): Response => {
    end(c);
    const problem = problemSchema.parse({
      type: PROBLEM_TYPES.unauthorized,
      title: 'Unauthorized',
      status: 401,
      detail,
    });
    return c.newResponse(JSON.stringify(problem), 401, {
      'content-type': 'application/problem+json',
    });
  };

  const gate: MiddlewareHandler<AuthEnv> = async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE);
    const opened = token === undefined ? null : await sealer.open(token);
    if (opened === null) {
      return reject(c, 'Connect Linear to continue.');
    }
    let session = opened;
    if (session.expiresAt - REFRESH_SKEW_MS <= now()) {
      if (session.refreshToken === null) {
        return reject(c, 'Your Linear session expired.');
      }
      try {
        const tokens = await oauth.refresh(session.refreshToken);
        session = { ...session, ...tokens };
      } catch (error) {
        // Only a refusal ends the session: a Linear outage must not log
        // everyone out.
        if (error instanceof UnauthorizedError) {
          return reject(c, 'Your Linear session expired.');
        }
        throw error;
      }
      await write(c, session);
    }
    c.set('session', session);
    await next();
  };

  return { require: gate, start: write, end };
}
