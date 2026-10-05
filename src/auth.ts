import type { Context } from 'hono';

const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SESSION_COOKIE = 'session';

export interface SessionUser {
  userId: number;
  email: string;
  displayName: string | null;
  organizationId: number;
  role: string;
}

function encodeText(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function hexToBuffer(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

export async function hashPassword(password: string): Promise<{ hash: string; salt: string }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', encodeText(password), 'PBKDF2', false, ['deriveBits']);
  const hash = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key,
    256
  );
  return { hash: bufferToHex(hash), salt: bufferToHex(salt.buffer as ArrayBuffer) };
}

export async function verifyPassword(password: string, saltHex: string, hashHex: string): Promise<boolean> {
  const salt = hexToBuffer(saltHex);
  const expectedHash = hexToBuffer(hashHex);
  const key = await crypto.subtle.importKey('raw', encodeText(password), 'PBKDF2', false, ['deriveBits']);
  const actualHash = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      key,
      256
    )
  );
  if (actualHash.length !== expectedHash.length) return false;
  return crypto.subtle.timingSafeEqual(actualHash, expectedHash);
}

export function randomToken(): string {
  return bufferToHex(crypto.getRandomValues(new Uint8Array(32)).buffer as ArrayBuffer);
}

export async function createSession(
  sessions: KVNamespace,
  user: SessionUser
): Promise<string> {
  const token = randomToken();
  await sessions.put(`session:${token}`, JSON.stringify(user), {
    expirationTtl: SESSION_TTL_SECONDS,
  });
  return token;
}

export async function getSession(sessions: KVNamespace, token: string): Promise<SessionUser | null> {
  const data = await sessions.get(`session:${token}`);
  if (!data) return null;
  try {
    return JSON.parse(data) as SessionUser;
  } catch {
    return null;
  }
}

export async function deleteSession(sessions: KVNamespace, token: string): Promise<void> {
  await sessions.delete(`session:${token}`);
}

export function setSessionCookie(c: Context, token: string): void {
  const isSecure = c.req.url.startsWith('https://');
  c.header(
    'Set-Cookie',
    `${SESSION_COOKIE}=${token}; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`,
    { append: true }
  );
}

export function clearSessionCookie(c: Context): void {
  const isSecure = c.req.url.startsWith('https://');
  c.header(
    'Set-Cookie',
    `${SESSION_COOKIE}=; Max-Age=0; HttpOnly; Path=/; SameSite=Lax${isSecure ? '; Secure' : ''}`,
    { append: true }
  );
}

export function getSessionToken(c: Context): string | undefined {
  const cookie = c.req.header('Cookie');
  if (!cookie) return undefined;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  return match?.[1];
}
