import test from 'node:test';
import assert from 'node:assert/strict';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { chainId } from '../src/lib/config';
import { createDatabase, migrate, one } from '../src/server/database';
import { issueNonce, verifyLogin, digest } from '../src/server/auth';

test('wallet login consumes the nonce atomically and stores only a session hash', async () => {
  const db = createDatabase('file::memory:'); await migrate(db);
  try {
    const account = privateKeyToAccount(generatePrivateKey()); const now = Date.now();
    const nonce = await issueNonce(db, now);
    const message = createSiweMessage({ address: account.address, version: '1', chainId, domain: nonce.domain, uri: nonce.uri, nonce: nonce.nonce, issuedAt: new Date(now), expirationTime: new Date(now + 300_000) });
    const signature = await account.signMessage({ message });
    const logins = await Promise.allSettled([verifyLogin(message, signature, db, now), verifyLogin(message, signature, db, now)]);
    assert.equal(logins.filter(r => r.status === 'fulfilled').length, 1);
    const session = logins.find(r => r.status === 'fulfilled')!;
    if (session.status !== 'fulfilled') throw new Error('Login did not succeed.');
    const saved = await one(db, 'SELECT * FROM fl_sessions');
    assert.equal(saved!.token_hash, digest(session.value.token));
    assert.equal(saved!.wallet, account.address.toLowerCase());
    await assert.rejects(verifyLogin(message, signature, db, now), { code: 'NONCE_USED' });
  } finally { await db.close(); }
});
test('wrong app/network and expired login messages are rejected before signature verification', async () => {
  const db = createDatabase('file::memory:'); await migrate(db);
  try {
    const account = privateKeyToAccount(generatePrivateKey()); const now = Date.now(); const nonce = await issueNonce(db, now);
    const base = { address: account.address, version: '1' as const, chainId, domain: nonce.domain, uri: nonce.uri, nonce: nonce.nonce, issuedAt: new Date(now), expirationTime: new Date(now + 300_000) };
    for (const patch of [{ domain: 'wrong.example' }, { chainId: chainId + 1 }, { uri: 'https://wrong.example' }]) {
      const message = createSiweMessage({ ...base, ...patch });
      await assert.rejects(verifyLogin(message, await account.signMessage({ message }), db, now), { code: 'WRONG_DOMAIN' });
    }
    const message = createSiweMessage({ ...base, expirationTime: new Date(now) });
    await assert.rejects(verifyLogin(message, await account.signMessage({ message }), db, now), { code: 'EXPIRED_SIGNATURE' });
  } finally { await db.close(); }
});
