// Admin login: password check and signed session tokens (pure helpers, tested in test/server/).
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_MS = 12 * 3600 * 1000;
export const COOKIE = 'kk_admin';

/** constant-time comparison of two strings of any length (hashed first, so the lengths match) */
export function safeEqual(a, b) {
  const ha = createHash('sha256').update(String(a)).digest();
  const hb = createHash('sha256').update(String(b)).digest();
  return timingSafeEqual(ha, hb);
}

/** the signing key: ADMIN_SECRET, or derived from the password (a new password ends all sessions) */
export function sessionSecret(env) {
  if (env.ADMIN_SECRET) return env.ADMIN_SECRET;
  return createHash('sha256').update('krakel-krone-admin:' + (env.ADMIN_PASSWORD || '')).digest('base64url');
}

const sign = (secret, payload) => createHmac('sha256', secret).update(payload).digest('base64url');

export function makeToken(secret, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ exp: now + SESSION_MS })).toString('base64url');
  return `${payload}.${sign(secret, payload)}`;
}

export function verifyToken(secret, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 300) return false;
  const [payload, mac, extra] = token.split('.');
  if (!payload || !mac || extra !== undefined) return false;
  const want = Buffer.from(sign(secret, payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    return typeof exp === 'number' && exp > now;
  } catch {
    return false;
  }
}

export function readCookie(header, name) {
  for (const part of String(header || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

export function sessionCookie(token, secure) {
  return `${COOKIE}=${token}; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=${SESSION_MS / 1000}${secure ? '; Secure' : ''}`;
}

export function clearCookie(secure) {
  return `${COOKIE}=; Path=/api/admin; HttpOnly; SameSite=Strict; Max-Age=0${secure ? '; Secure' : ''}`;
}
