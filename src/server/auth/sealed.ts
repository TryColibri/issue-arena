import { createHash } from 'node:crypto';

import { EncryptJWT, jwtDecrypt } from 'jose';
import { type z } from 'zod';

/** Seals small JSON values into opaque, tamper-proof strings, for cookies. */
export type Sealer<T> = {
  /**
   * Encrypts a value.
   *
   * @param value - The value to seal.
   * @param ttlSeconds - How long the sealed string stays valid.
   */
  seal(value: T, ttlSeconds: number): Promise<string>;
  /**
   * Decrypts a sealed string.
   *
   * @param token - What `seal` returned.
   * @returns The value, or `null` when the token is forged, expired or malformed.
   */
  open(token: string): Promise<T | null>;
};

/**
 * Creates a sealer: `dir` + `A256GCM` JWE, keyed by a hash of `secret`. The
 * value is validated with `schema` on the way out, so a stale cookie from an
 * older shape is rejected instead of trusted.
 *
 * @param secret - The application secret.
 * @param purpose - Mixed into the key, so tokens of one purpose never open as another.
 * @param schema - Shape of the value.
 */
export function createSealer<T>(
  secret: string,
  purpose: string,
  schema: z.ZodType<T>,
): Sealer<T> {
  const key = createHash('sha256').update(`${purpose}:${secret}`).digest();
  return {
    async seal(value, ttlSeconds) {
      return new EncryptJWT({ v: schema.parse(value) })
        .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
        .setIssuedAt()
        .setExpirationTime(`${ttlSeconds}s`)
        .encrypt(key);
    },
    async open(token) {
      try {
        const { payload } = await jwtDecrypt(token, key);
        const parsed = schema.safeParse(payload.v);
        return parsed.success ? parsed.data : null;
      } catch {
        return null;
      }
    },
  };
}
