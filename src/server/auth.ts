import { createHash, randomBytes } from 'node:crypto';
import { parseSiweMessage } from 'viem/siwe';
import { getAddress, type Hex } from 'viem';
import { chainId } from '../lib/config';
import { chainClient } from './chain';
import { database, one, type Database } from './database';
import { ensure } from './errors';

export const appUrl = () => new URL(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3020');
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function issueNonce(db?: Database, now = Date.now()) {
  db ||= await database();
  const nonce = randomBytes(24).toString('hex');
  await db.query('INSERT INTO fl_nonces(nonce_hash,expires_at) VALUES(?,?)', [digest(nonce), now + 300_000]);
  return { nonce, domain: appUrl().host, uri: appUrl().origin, chainId, serverNow: now };
}
export async function verifyLogin(message: string, signature: Hex, db?: Database, now = Date.now()) {
  db ||= await database();
  let siwe;
  try { siwe = parseSiweMessage(message); } catch { ensure(false, 'INVALID_SIGNATURE', 'The login message is invalid.', 401); }
  ensure(siwe.address && siwe.nonce && siwe.issuedAt && siwe.expirationTime, 'INVALID_SIGNATURE', 'The login message is incomplete.', 401);
  ensure(siwe.domain === appUrl().host && siwe.uri === appUrl().origin && siwe.chainId === chainId, 'WRONG_DOMAIN', 'This signature belongs to a different app or network.', 401);
  ensure(siwe.issuedAt.getTime() <= now + 30_000 && siwe.issuedAt.getTime() >= now - 300_000 && siwe.expirationTime.getTime() > now && siwe.expirationTime.getTime() <= now + 330_000, 'EXPIRED_SIGNATURE', 'Your login signature has expired. Sign in again.', 401);
  const wallet = getAddress(siwe.address).toLowerCase();
  const nonce = await one(db, 'SELECT * FROM fl_nonces WHERE nonce_hash=?', [digest(siwe.nonce)]);
  ensure(nonce && Number(nonce.expires_at) > now && !Number(nonce.consumed), 'NONCE_USED', 'This login request has expired or was already used.', 401);
  let valid = false;
  try { valid = await chainClient().verifyMessage({ address: getAddress(wallet), message, signature }); } catch { /* false */ }
  ensure(valid, 'INVALID_SIGNATURE', 'The wallet signature could not be verified.', 401);
  const token = randomBytes(32).toString('hex');
  await db.transaction(async tx => {
    const changed = await tx.query('UPDATE fl_nonces SET consumed=1 WHERE nonce_hash=? AND consumed=0 AND expires_at>?', [digest(siwe.nonce!), now]);
    ensure(changed.count === 1, 'NONCE_USED', 'This login request was already used.', 401);
    await tx.query('INSERT INTO fl_sessions(token_hash,wallet,expires_at) VALUES(?,?,?)', [digest(token), wallet, now + 12 * 3600_000]);
  });
  return { token, wallet };
}
export async function sessionWallet(request: Request, required = true) {
  const cookie = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('fl_session='))?.slice(11);
  const db = await database();
  const session = cookie ? await one(db, 'SELECT wallet FROM fl_sessions WHERE token_hash=? AND expires_at>?', [digest(cookie), Date.now()]) : null;
  if (required) ensure(session, 'SIGN_IN', 'Sign in with your wallet to continue.', 401);
  return session?.wallet as string | undefined;
}
export async function requireOrigin(request: Request) {
  ensure(request.headers.get('origin') === appUrl().origin && request.headers.get('x-flat-league') === '1', 'BAD_ORIGIN', 'This request did not come from Flat League.', 403);
}
export async function rateLimit(request: Request, kind: string, limit = 120) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || 'local';
  const bucket = Math.floor(Date.now() / 60_000);
  const key = digest(`${kind}:${ip}:${bucket}`);
  const db = await database();
  const row = await one(db, 'INSERT INTO fl_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=fl_rate_limits.count+1 RETURNING count', [key, (bucket + 2) * 60_000]);
  ensure(Number(row?.count || 1) <= limit, 'RATE_LIMIT', 'Too many requests. Wait a minute and try again.', 429);
}
