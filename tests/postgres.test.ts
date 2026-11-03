import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { createSiweMessage } from 'viem/siwe';
import { createDatabase, migrate, one, type Database } from '../src/server/database';
import { schemaStatements, privateTables } from '../src/server/schema';
import { joinCompetition, startAttempt, answerAttempt, getAttempt } from '../src/server/league';
import { digest, issueNonce, verifyLogin } from '../src/server/auth';
import { demoQuestions } from '../packages/shared/demo-questions';
import { chainId } from '../src/lib/config';

// Use an isolated validation cluster: this suite creates a temporary database
// and roles, and needs CREATE DATABASE / CREATE ROLE privileges in that cluster.
const url = process.env.POSTGRES_TEST_URL;
const wallet = '0x0000000000000000000000000000000000000001';
const hash = '0x' + 'a'.repeat(64);
const tables = schemaStatements.filter(s => s.startsWith('CREATE TABLE')).map(s => s.match(/EXISTS (\w+)/)![1]);
const relation = (table: string) => `${privateTables.includes(table) ? 'private' : 'public'}.${table}`;

async function round(db: Database, capacity = 100, registered = true) {
  const id = randomUUID(), now = Date.now();
  await db.query('INSERT INTO fl_competitions(id,onchain_id,creator,title,description,pool,start_at,end_at,finalize_by,max_participants,rules_hash,question_commitment,result_signer,registrar,funding_hash,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',
    [id, id, wallet, 'Postgres round', 'Concurrency validation', '101', now - 1000, now + 300_000, now + 86400_000, capacity, hash, hash, wallet, wallet, hash, 0, now]);
  await db.query('INSERT INTO fl_question_packs(competition_id,questions_json,salt) VALUES(?,?,?)', [id, JSON.stringify(demoQuestions), hash]);
  if (registered) await db.query("INSERT INTO fl_participants(competition_id,wallet,status,created_at) VALUES(?,?,'confirmed',?)", [id, wallet, now]);
  return { id, now };
}

test('PostgreSQL permissions and concurrent app/worker requests', { skip: !url, timeout: 60_000 }, async t => {
  const admin = new Pool({ connectionString: url });
  const name = `fl_test_${randomUUID().replaceAll('-', '')}`;
  const owner = `${name}_owner`, password = randomUUID();
  const createdRoles: string[] = [];
  let databaseCreated = false, ownerCreated = false;
  let inspector: Pool | undefined, app: Database | undefined, worker: Database | undefined;
  try {
    for (const role of ['anon', 'authenticated']) {
      if (!(await admin.query('SELECT 1 FROM pg_roles WHERE rolname=$1', [role])).rowCount) {
        await admin.query(`CREATE ROLE ${role} NOLOGIN`); createdRoles.push(role);
      }
    }
    await admin.query(`CREATE ROLE ${owner} LOGIN PASSWORD '${password}' NOSUPERUSER NOBYPASSRLS`); ownerCreated = true;
    await admin.query(`CREATE DATABASE ${name} OWNER ${owner}`); databaseCreated = true;
    const adminUrl = new URL(url!); adminUrl.pathname = `/${name}`;
    inspector = new Pool({ connectionString: adminUrl.toString() });
    const appUrl = new URL(adminUrl); appUrl.username = owner; appUrl.password = password;
    app = createDatabase(appUrl.toString()); worker = createDatabase(appUrl.toString());
    const db = app, other = worker, raw = inspector;

    await t.test('migration removes inherited and explicit API grants and is repeatable', async () => {
      await db.query('CREATE SCHEMA private');
      await raw.query(`ALTER DEFAULT PRIVILEGES FOR ROLE ${owner} IN SCHEMA public, private GRANT ALL ON TABLES TO PUBLIC, anon, authenticated`);
      await migrate(db);
      // Reproduce existing Supabase grants, including private-schema access.
      await raw.query('GRANT ALL ON SCHEMA private TO PUBLIC, anon, authenticated');
      for (const table of tables) await raw.query(`GRANT ALL ON ${relation(table)} TO PUBLIC, anon, authenticated`);
      await migrate(db); await migrate(db);
      const role = await raw.query('SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=$1', [owner]);
      assert.deepEqual(role.rows[0], { rolsuper: false, rolbypassrls: false });
      for (const apiRole of ['anon', 'authenticated']) {
        const schema = await raw.query("SELECT has_schema_privilege($1,'private','USAGE') AS usage,has_schema_privilege($1,'private','CREATE') AS create", [apiRole]);
        assert.deepEqual(schema.rows[0], { usage: false, create: false });
        for (const table of tables) {
          const privileges = await raw.query("SELECT has_table_privilege($1,$2,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') AS allowed", [apiRole, relation(table)]);
          assert.equal(privileges.rows[0].allowed, false, `${apiRole} can access ${table}`);
        }
      }
      for (const table of tables) {
        const result = await raw.query('SELECT relrowsecurity FROM pg_class WHERE oid=$1::regclass', [relation(table)]);
        assert.equal(result.rows[0].relrowsecurity, true, table);
      }
      await db.query('CREATE TABLE private.future_validation_table (id INTEGER)');
      const future = await raw.query("SELECT has_table_privilege('anon','private.future_validation_table','SELECT') AS allowed");
      assert.equal(future.rows[0].allowed, false);
      // Test actual access, including RLS when SELECT is deliberately regranted.
      const { id } = await round(db);
      const client = await raw.connect();
      try {
        for (const apiRole of ['anon', 'authenticated']) {
          await client.query(`SET ROLE ${apiRole}`);
          await assert.rejects(client.query('SELECT * FROM private.fl_question_packs'), { code: '42501' });
          await assert.rejects(client.query('SELECT * FROM public.fl_competitions'), { code: '42501' });
          await client.query('RESET ROLE');
        }
        await client.query('GRANT SELECT ON public.fl_competitions TO anon');
        await client.query('SET ROLE anon');
        assert.equal((await client.query('SELECT * FROM public.fl_competitions')).rowCount, 0);
        await client.query('RESET ROLE'); await migrate(db);
      } finally { await client.query('RESET ROLE'); client.release(); }
      assert.ok(await one(other, 'SELECT id FROM fl_competitions WHERE id=?', [id]));
    });

    await t.test('two independent pools reserve capacity without duplicate registration jobs', async () => {
      const { id, now } = await round(db, 3, false);
      const wallets = Array.from({ length: 16 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`);
      const results = await Promise.allSettled(wallets.map((w, i) => joinCompetition(id, w, i % 2 ? db : other, now)));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 3);
      for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.code, 'FULL');
      assert.equal(Number((await one(db, 'SELECT COUNT(*) AS count FROM fl_participants WHERE competition_id=?', [id]))!.count), 3);
      const winner = wallets[results.findIndex(r => r.status === 'fulfilled')];
      await Promise.all(Array.from({ length: 8 }, (_, i) => joinCompetition(id, winner, i % 2 ? db : other, now + 600_000)));
      assert.equal(Number((await one(db, 'SELECT COUNT(*) AS count FROM fl_jobs WHERE payload LIKE ?', [`%${id}%`]))!.count), 3);
    });

    await t.test('concurrent starts produce one attempt with numeric deadlines and private scores', async () => {
      const { id, now } = await round(db);
      const starts = await Promise.all(Array.from({ length: 16 }, (_, i) => startAttempt(id, wallet, i % 2 ? db : other, now)));
      assert.equal(new Set(starts.map(a => a.id)).size, 1);
      assert.equal(Number((await one(db, 'SELECT COUNT(*) AS count FROM fl_attempts WHERE competition_id=?', [id]))!.count), 1);
      assert.equal(starts[0].deadline, now + 120_000);
      assert.equal('correctOption' in starts[0].question!, false); assert.equal('score' in starts[0], false);
    });

    await t.test('racing answers stay immutable; retries and exact-deadline expiry preserve scoring', async () => {
      const { id, now } = await round(db);
      const attempt = await startAttempt(id, wallet, db, now), q = attempt.question!;
      const correct = demoQuestions.find(item => item.id === q.id)!.correctOption;
      const wrong = q.options.find(option => option.id !== correct)!.id;
      const keys = [randomUUID(), randomUUID()], options = [correct, wrong];
      const results = await Promise.allSettled(options.map((option, i) => answerAttempt(attempt.id, wallet, q.id, option, keys[i], i ? other : db, now + 1000)));
      assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
      for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.code, 'INVALID_ANSWER');
      const winner = results.findIndex(r => r.status === 'fulfilled');
      const retries = await Promise.all(Array.from({ length: 8 }, (_, i) => answerAttempt(attempt.id, wallet, q.id, options[winner], keys[winner], i % 2 ? db : other, now + 2000)));
      assert.ok(retries.every(a => a.accepted === 1));
      await assert.rejects(answerAttempt(attempt.id, wallet, q.id, options[1 - winner], keys[winner], db, now + 2000), { code: 'KEY_REUSED' });
      const current = retries[0].question!;
      const expiry = await Promise.allSettled([
        answerAttempt(attempt.id, wallet, current.id, current.options[0].id, randomUUID(), db, attempt.deadline),
        getAttempt(attempt.id, wallet, other, attempt.deadline)
      ]);
      assert.equal(expiry[0].status, 'rejected');
      if (expiry[0].status === 'rejected') assert.equal(expiry[0].reason.code, 'TIME_UP');
      assert.equal(expiry[1].status, 'fulfilled');
      if (expiry[1].status === 'fulfilled') assert.equal(expiry[1].value.state, 'submitted');
      const sealed = await one(db, 'SELECT state,score,elapsed_ms FROM fl_attempts WHERE id=?', [attempt.id]);
      assert.deepEqual(sealed, { state: 'submitted', score: winner === 0 ? 10 : 0, elapsed_ms: 120_000 });
      assert.equal((await answerAttempt(attempt.id, wallet, q.id, options[winner], keys[winner], other, attempt.deadline)).accepted, 1);
      assert.equal(Number((await one(db, 'SELECT COUNT(*) AS count FROM fl_answers WHERE attempt_id=?', [attempt.id]))!.count), 1);
    });

    await t.test('simultaneous SIWE logins consume a nonce once across pools', async () => {
      const account = privateKeyToAccount(generatePrivateKey()), now = Date.now();
      const nonce = await issueNonce(db, now);
      const message = createSiweMessage({ address: account.address, version: '1', chainId, domain: nonce.domain, uri: nonce.uri, nonce: nonce.nonce, issuedAt: new Date(now), expirationTime: new Date(now + 300_000) });
      const signature = await account.signMessage({ message });
      const logins = await Promise.allSettled(Array.from({ length: 8 }, (_, i) => verifyLogin(message, signature, i % 2 ? db : other, now)));
      assert.equal(logins.filter(r => r.status === 'fulfilled').length, 1);
      for (const result of logins) if (result.status === 'rejected') assert.equal(result.reason.code, 'NONCE_USED');
      const success = logins.find(r => r.status === 'fulfilled')!;
      if (success.status !== 'fulfilled') throw new Error('No successful login');
      const saved = await one(other, 'SELECT * FROM fl_sessions WHERE wallet=?', [account.address.toLowerCase()]);
      assert.equal(saved!.token_hash, digest(success.value.token));
      await assert.rejects(verifyLogin(message, signature, other, now), { code: 'NONCE_USED' });
    });

    await t.test('private-table upserts preserve every concurrent increment', async () => {
      const key = randomUUID();
      await Promise.all(Array.from({ length: 24 }, (_, i) => (i % 2 ? db : other).query('INSERT INTO fl_rate_limits(key,count,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=fl_rate_limits.count+1 RETURNING count', [key, Date.now() + 60_000])));
      assert.equal((await one(db, 'SELECT count FROM fl_rate_limits WHERE key=?', [key]))!.count, 24);
    });

    await t.test('failed transactions roll back both public and private writes', async () => {
      const key = randomUUID();
      await assert.rejects(db.transaction(async tx => {
        await tx.query('INSERT INTO fl_state(key,value) VALUES(?,?)', [key, 'rollback']);
        await tx.query('INSERT INTO fl_rewards(competition_id,wallet,amount) VALUES(?,?,?)', [key, wallet, '42']);
        throw new Error('abort');
      }), /abort/);
      assert.equal(await one(other, 'SELECT * FROM fl_state WHERE key=?', [key]), null);
      assert.equal(await one(other, 'SELECT * FROM fl_rewards WHERE competition_id=?', [key]), null);
    });
  } finally {
    await Promise.all([app?.close(), worker?.close(), inspector?.end()]);
    if (databaseCreated) await admin.query(`DROP DATABASE ${name} WITH (FORCE)`);
    if (ownerCreated) await admin.query(`DROP ROLE ${owner}`);
    for (const role of createdRoles) await admin.query(`DROP ROLE ${role}`);
    await admin.end();
  }
});
