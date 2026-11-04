import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createDatabase, migrate, one, type Database } from '../src/server/database';
import { startAttempt, answerAttempt, getAttempt, joinCompetition, standingsFor, listCompetitions, markDemoCompetition } from '../src/server/league';
import { allocatePool, canonical, commitQuestions, hashArtifact, rankAttempts } from '../packages/shared/domain';
import { demoQuestions } from '../packages/shared/demo-questions';
import { requireOrigin } from '../src/server/auth';

const wallet = '0x0000000000000000000000000000000000000001';
const second = '0x0000000000000000000000000000000000000002';
const now = Date.now();
const hash = '0x' + 'a'.repeat(64);
async function fixture(registered = true, capacity = 100) {
  const db = createDatabase('file::memory:'); await migrate(db);
  await db.query('INSERT INTO fl_competitions(id,onchain_id,creator,title,description,pool,start_at,end_at,finalize_by,max_participants,rules_hash,question_commitment,result_signer,registrar,funding_hash,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)', ['round', '1', wallet, 'Test round', 'A test competition', '101', now - 1000, now + 300_000, now + 86400_000, capacity, hash, hash, wallet, wallet, hash, 0, now]);
  await db.query('INSERT INTO fl_question_packs(competition_id,questions_json,salt) VALUES(?,?,?)', ['round', JSON.stringify(demoQuestions), hash]);
  if (registered) await db.query("INSERT INTO fl_participants(competition_id,wallet,status,created_at) VALUES(?,?,'confirmed',?)", ['round', wallet, now]);
  return db;
}
async function withDb(fn: (db: Database) => Promise<void>, registered = true, capacity = 100) {
  const db = await fixture(registered, capacity); try { await fn(db); } finally { await db.close(); }
}
function answerFor(questionId: string) { return demoQuestions.find(q => q.id === questionId)!.correctOption; }

test('demo rounds leave public discovery while genuine rounds and retained evidence remain', () => withDb(async db => {
  await db.query("INSERT INTO fl_competitions SELECT 'genuine', '2', creator, title, description, pool, start_at, end_at, finalize_by, max_participants, rules_hash, question_commitment, result_signer, registrar, funding_hash, state, settlement_hash, result_json, signature, created_at FROM fl_competitions WHERE id='round'");
  assert.equal((await listCompetitions(undefined, db)).length, 2);
  await markDemoCompetition('round', db);
  await markDemoCompetition('round', db);
  assert.deepEqual((await listCompetitions(undefined, db)).map(c => c.id), ['genuine']);
  assert.deepEqual((await listCompetitions(wallet, db)).map(c => c.id), ['genuine']);
  assert.ok(await one(db, 'SELECT funding_hash FROM fl_competitions WHERE id=?', ['round']));
  await assert.rejects(markDemoCompetition('missing', db), { code: 'NOT_FOUND' });
}));

test('concurrent starts create one attempt and reveal only the current question', () => withDb(async db => {
  const attempts = await Promise.all(Array.from({ length: 8 }, () => startAttempt('round', wallet, db, now)));
  assert.equal(new Set(attempts.map(a => a.id)).size, 1);
  assert.equal((await one(db, 'SELECT COUNT(*) AS count FROM fl_attempts'))!.count, 1);
  assert.equal(attempts[0].deadline, now + 120_000);
  assert.ok(attempts[0].question);
  assert.equal('correctOption' in attempts[0].question, false);
  assert.equal('score' in attempts[0], false);
  await assert.rejects(getAttempt(attempts[0].id, second, db, now), { code: 'NOT_FOUND' });
}));
test('concurrent joins respect capacity and enqueue one registration', () => withDb(async db => {
  const joined = await Promise.allSettled([joinCompetition('round', wallet, db, now), joinCompetition('round', second, db, now)]);
  assert.equal(joined.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal((await one(db, 'SELECT COUNT(*) AS count FROM fl_participants'))!.count, 1);
  assert.equal((await one(db, 'SELECT COUNT(*) AS count FROM fl_jobs'))!.count, 1);
  await joinCompetition('round', wallet, db, now + 600_000);
}, false, 1));
test('unconfirmed players cannot start; cutoff reserves the entire timer', () => withDb(async db => {
  await assert.rejects(startAttempt('round', wallet, db, now), { code: 'REGISTER_FIRST' });
  await assert.rejects(joinCompetition('round', wallet, db, now + 180_000), { code: 'ENTRIES_CLOSED' });
}, false));
test('answer retries are idempotent and concurrent changes cannot replace a locked answer', () => withDb(async db => {
  const a = await startAttempt('round', wallet, db, now); const q = a.question!; const key = randomUUID();
  const payload = [a.id, wallet, q.id, answerFor(q.id), key, db, now + 1000] as const;
  const views = await Promise.all([answerAttempt(...payload), answerAttempt(...payload)]);
  assert.ok(views.every(v => v.accepted === 1));
  assert.equal((await one(db, 'SELECT COUNT(*) AS count FROM fl_answers'))!.count, 1);
  const other = q.options.find(o => o.id !== answerFor(q.id))!.id;
  await assert.rejects(answerAttempt(a.id, wallet, q.id, other, key, db, now + 2000), { code: 'KEY_REUSED' });
  await assert.rejects(answerAttempt(a.id, wallet, q.id, other, randomUUID(), db, now + 2000), { code: 'INVALID_ANSWER' });
}));
test('ten answers seal a server-scored run while live scores stay private', () => withDb(async db => {
  let a = await startAttempt('round', wallet, db, now);
  for (let i = 0; i < 10; i++) a = await answerAttempt(a.id, wallet, a.question!.id, answerFor(a.question!.id), randomUUID(), db, now + (i + 1) * 1000);
  assert.equal(a.state, 'submitted'); assert.equal(a.question, null); assert.equal('score' in a, false);
  const saved = await one(db, 'SELECT score,elapsed_ms FROM fl_attempts WHERE id=?', [a.id]);
  assert.equal(saved!.score, 100); assert.equal(saved!.elapsed_ms, 10_000);
  assert.deepEqual(await standingsFor('round', db), []);
  await db.query('UPDATE fl_competitions SET end_at=? WHERE id=?', [now - 1, 'round']);
  assert.equal((await standingsFor('round', db))[0].reward, '101');
  await db.query('UPDATE fl_competitions SET state=3 WHERE id=?', ['round']);
  assert.equal((await standingsFor('round', db))[0].reward, '0');
}));
test('exact deadline rejects new answers but preserves partial scoring and old retries', () => withDb(async db => {
  let a = await startAttempt('round', wallet, db, now); const q = a.question!; const key = randomUUID();
  a = await answerAttempt(a.id, wallet, q.id, answerFor(q.id), key, db, now + 1000);
  await assert.rejects(answerAttempt(a.id, wallet, a.question!.id, answerFor(a.question!.id), randomUUID(), db, a.deadline), { code: 'TIME_UP' });
  const expired = await getAttempt(a.id, wallet, db, a.deadline);
  assert.equal(expired.state, 'submitted'); assert.equal(expired.accepted, 1);
  const saved = await one(db, 'SELECT score,elapsed_ms FROM fl_attempts WHERE id=?', [a.id]);
  assert.equal(saved!.score, 10); assert.equal(saved!.elapsed_ms, 120_000);
  assert.equal((await answerAttempt(a.id, wallet, q.id, answerFor(q.id), key, db, a.deadline)).accepted, 1);
}));
test('no-answer expiry abandons an attempt without prize eligibility', () => withDb(async db => {
  const a = await startAttempt('round', wallet, db, now);
  assert.equal((await getAttempt(a.id, wallet, db, a.deadline)).state, 'abandoned');
}));
test('ranking applies all four tie breakers; allocation conserves base units', () => {
  const rows = [{ wallet: second, score: 100, elapsedMs: 1000, startedAt: now }, { wallet, score: 100, elapsedMs: 1000, startedAt: now }, { wallet: '0x3', score: 100, elapsedMs: 999, startedAt: now + 1 }, { wallet: '0x4', score: 90, elapsedMs: 1, startedAt: 1 }];
  assert.deepEqual(rankAttempts(rows).map(r => r.wallet), ['0x3', wallet, second, '0x4']);
  for (let count = 1; count <= 5; count++) for (const pool of [1n, 2n, 101n, 10n ** 30n]) {
    const payouts = allocatePool(pool, count);
    assert.equal(payouts.reduce((s, p) => s + p, 0n), pool);
    assert.equal(payouts.length, Math.min(3, count));
  }
  assert.deepEqual(allocatePool(100n, 2), [71n, 29n]);
  assert.deepEqual(allocatePool(100n, 0), []);
});
test('commitments bind the question pack and salt; canonical artifacts ignore key order', () => {
  assert.equal(canonical({ b: 2, a: 1 }), canonical({ a: 1, b: 2 }));
  assert.equal(hashArtifact({ b: 2, a: 1 }), hashArtifact({ a: 1, b: 2 }));
  assert.notEqual(commitQuestions(demoQuestions, hash as `0x${string}`), commitQuestions(demoQuestions, ('0x' + 'b'.repeat(64)) as `0x${string}`));
});
test('mutations reject requests without the app origin and custom header', async () => {
  await assert.rejects(requireOrigin(new Request('http://localhost:3020/api/competitions', { headers: { origin: 'https://elsewhere.example', 'x-flat-league': '1' } })), { code: 'BAD_ORIGIN' });
  await assert.rejects(requireOrigin(new Request('http://localhost:3020/api/competitions', { headers: { origin: 'http://localhost:3020' } })), { code: 'BAD_ORIGIN' });
  await requireOrigin(new Request('http://localhost:3020/api/competitions', { headers: { origin: 'http://localhost:3020', 'x-flat-league': '1' } }));
});
