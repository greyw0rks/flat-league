import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { decodeEventLog, getAddress, parseUnits, type Address, type Hex } from 'viem';
import { managerAbi } from '../../packages/contracts/managerAbi';
import { draftSchema, canonical, commitQuestions, hashArtifact, competitionStatus, rankAttempts, allocatePool, type DraftInput, type Question, type CompetitionView, type AttemptView, type Standing } from '../../packages/shared/domain';
import { chainId, managerAddress, wifAddress } from '../lib/config';
import { database, one, type Database, type Executor, type Row } from './database';
import { chainClient, requireManager, confirmations } from './chain';
import { ensure } from './errors';

export async function enqueue(db: Executor, kind: string, effectKey: string, payload: unknown, now = Date.now()) {
  await db.query('INSERT INTO fl_jobs(id,effect_key,kind,payload,status,next_at) VALUES(?,?,?,?,?,?) ON CONFLICT(effect_key) DO NOTHING', [randomUUID(), effectKey, kind, JSON.stringify(payload), 'ready', now]);
}
export async function competitionRow(id: string, db: Executor) {
  const c = await one(db, 'SELECT * FROM fl_competitions WHERE id=?', [id]);
  ensure(c, 'NOT_FOUND', 'This competition could not be found.', 404); return c;
}
export async function competitionView(c: Row, db: Executor, wallet?: string, now = Date.now()): Promise<CompetitionView> {
  const count = await one(db, "SELECT COUNT(*) AS count FROM fl_participants WHERE competition_id=? AND status='confirmed'", [String(c.id)]);
  const participant = wallet ? await one(db, 'SELECT status FROM fl_participants WHERE competition_id=? AND wallet=?', [String(c.id), wallet.toLowerCase()]) : null;
  const attempt = wallet ? await one(db, 'SELECT id,state FROM fl_attempts WHERE competition_id=? AND wallet=?', [String(c.id), wallet.toLowerCase()]) : null;
  return { id: String(c.id), onchainId: String(c.onchain_id), creator: getAddress(String(c.creator)),
    title: String(c.title), description: String(c.description), pool: String(c.pool),
    startAt: Number(c.start_at), endAt: Number(c.end_at), finalizeBy: Number(c.finalize_by), maxParticipants: Number(c.max_participants),
    participantCount: Number(count?.count || 0), status: competitionStatus(Number(c.state), Number(c.start_at), Number(c.end_at), Number(c.finalize_by), now),
    rulesHash: c.rules_hash as Hex, questionCommitment: c.question_commitment as Hex,
    resultSigner: getAddress(String(c.result_signer)), registrar: getAddress(String(c.registrar)), fundingHash: c.funding_hash as Hex,
    settlementHash: c.settlement_hash as Hex | null, joined: Boolean(participant), registrationStatus: participant?.status as string | undefined,
    attemptId: attempt?.id as string | undefined, attemptState: attempt?.state as string | undefined
  };
}
export async function markDemoCompetition(id: string, db?: Database) {
  db ||= await database();
  await competitionRow(id, db);
  await db.query("INSERT INTO fl_state(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING", ['demo-round:' + id, 'Local verification fixture']);
}
export async function listCompetitions(wallet?: string, db?: Database) {
  db ||= await database();
  const rows = await db.query("SELECT c.* FROM fl_competitions c WHERE NOT EXISTS (SELECT 1 FROM fl_state s WHERE s.key='demo-round:' || c.id) ORDER BY created_at DESC LIMIT 100");
  return Promise.all(rows.rows.map(c => competitionView(c, db, wallet)));
}
export async function getCompetition(id: string, wallet?: string) {
  const db = await database(); return competitionView(await competitionRow(id, db), db, wallet);
}
export async function createDraft(wallet: string, raw: unknown, db?: Database, now = Date.now()) {
  db ||= await database(); requireManager(); ensure(wifAddress, 'NOT_DEPLOYED', 'Configure the reward token first.', 503);
  const input = draftSchema.parse(raw);
  input.startAt = Math.floor(input.startAt / 1000) * 1000; input.endAt = Math.floor(input.endAt / 1000) * 1000;
  ensure(input.startAt > now + 5000, 'START_TOO_SOON', 'Choose a start time at least a few minutes from now.');
  const pool = parseUnits(input.pool, 18); ensure(pool > 0n, 'INVALID_POOL', 'The reward pool must be greater than zero.');
  const rules = { version: 1, title: input.title, description: input.description, creator: wallet.toLowerCase(), chainId,
    manager: managerAddress, token: wifAddress, pool: pool.toString(), startAt: input.startAt, endAt: input.endAt,
    finalizeBy: input.endAt + 86400_000, maxParticipants: input.maxParticipants, timerSeconds: 120,
    questionCount: 10, weights: [60, 25, 15], ties: ['score-desc', 'elapsed-asc', 'started-asc', 'wallet-asc'] };
  const id = randomUUID(), salt = ('0x' + randomBytes(32).toString('hex')) as Hex;
  const rulesHash = hashArtifact(rules), commitment = commitQuestions(input.questions, salt);
  await db.query('INSERT INTO fl_drafts(id,creator,input_json,salt,rules_json,rules_hash,question_commitment,created_at) VALUES(?,?,?,?,?,?,?,?)', [id, wallet.toLowerCase(), JSON.stringify(input), salt, canonical(rules), rulesHash, commitment, now]);
  return { id, rulesHash, questionCommitment: commitment, pool: pool.toString(),
    config: { rulesHash, questionCommitment: commitment, startAt: Math.floor(input.startAt / 1000), endAt: Math.floor(input.endAt / 1000), finalizeBy: Math.floor((input.endAt + 86400_000) / 1000), maxParticipants: input.maxParticipants } };
}
export async function publishDraft(wallet: string, draftId: string, txHash: Hex) {
  const db = await database();
  const draft = await one(db, 'SELECT * FROM fl_drafts WHERE id=? AND creator=?', [draftId, wallet.toLowerCase()]);
  ensure(draft, 'NOT_FOUND', 'Your draft could not be found.', 404);
  if (draft.published_id) return { id: String(draft.published_id) };
  const client = chainClient();
  let receipt;
  try { receipt = await client.getTransactionReceipt({ hash: txHash }); } catch { ensure(false, 'TX_PENDING', 'Funding is still confirming. Try publishing again shortly.', 409); }
  ensure(receipt.status === 'success', 'TX_FAILED', 'The funding transaction was not successful.');
  ensure((await client.getBlockNumber()) - receipt.blockNumber + 1n >= BigInt(confirmations()), 'TX_PENDING', 'Waiting for funding confirmation.', 409);
  let onchainId: bigint | undefined;
  for (const log of receipt.logs) {
    if (log.address.toLowerCase() !== requireManager().toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({ abi: managerAbi, data: log.data, topics: log.topics });
      if (decoded.eventName === 'CompetitionCreated' && decoded.args.creator.toLowerCase() === wallet.toLowerCase() && decoded.args.rulesHash === draft.rules_hash && decoded.args.questionCommitment === draft.question_commitment)
        onchainId = decoded.args.id;
    } catch { /* another event */ }
  }
  ensure(onchainId !== undefined, 'WRONG_TRANSACTION', 'That transaction does not fund this draft.');
  const onchain = await client.readContract({ address: requireManager(), abi: managerAbi, functionName: 'getCompetition', args: [onchainId] });
  const input = JSON.parse(String(draft.input_json)) as DraftInput;
  ensure(onchain.pool === parseUnits(input.pool, 18) && onchain.startAt * 1000n === BigInt(input.startAt) && onchain.endAt * 1000n === BigInt(input.endAt) && onchain.maxParticipants === input.maxParticipants, 'WRONG_CONFIG', 'The funded rules do not match this draft.');
  const id = draftId;
  await db.transaction(async tx => {
    await tx.query(`INSERT INTO fl_competitions(id,onchain_id,creator,title,description,pool,start_at,end_at,finalize_by,max_participants,rules_hash,question_commitment,result_signer,registrar,funding_hash,state,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(onchain_id) DO NOTHING`, [id, onchainId!.toString(), wallet.toLowerCase(), input.title, input.description, onchain.pool.toString(), input.startAt, input.endAt, Number(onchain.finalizeBy) * 1000, input.maxParticipants, String(draft.rules_hash), String(draft.question_commitment), onchain.resultSigner.toLowerCase(), onchain.registrar.toLowerCase(), txHash, onchain.status, Date.now()]);
    await tx.query('INSERT INTO fl_question_packs(competition_id,questions_json,salt) VALUES(?,?,?) ON CONFLICT(competition_id) DO NOTHING', [id, JSON.stringify(input.questions), String(draft.salt)]);
    await tx.query('UPDATE fl_drafts SET published_id=? WHERE id=?', [id, draftId]);
  });
  return { id };
}
export async function joinCompetition(id: string, wallet: string, db?: Database, now = Date.now()) {
  db ||= await database();
  return db.transaction(async tx => {
    const c = await one(tx, 'SELECT * FROM fl_competitions WHERE id=?' + (db.postgres ? ' FOR UPDATE' : ''), [id]);
    ensure(c, 'NOT_FOUND', 'This competition could not be found.', 404);
    const existing = await one(tx, 'SELECT status FROM fl_participants WHERE competition_id=? AND wallet=?', [id, wallet.toLowerCase()]);
    if (existing) return { status: String(existing.status) };
    ensure(Number(c.state) === 0 && now >= Number(c.start_at) && now + 120_000 < Number(c.end_at), 'ENTRIES_CLOSED', 'There is not enough time left to join this round.');
    const count = await one(tx, 'SELECT COUNT(*) AS count FROM fl_participants WHERE competition_id=?', [id]);
    ensure(Number(count?.count || 0) < Number(c.max_participants), 'FULL', 'This competition has reached its participant limit.');
    await tx.query('INSERT INTO fl_participants(competition_id,wallet,created_at) VALUES(?,?,?) ON CONFLICT(competition_id,wallet) DO NOTHING', [id, wallet.toLowerCase(), now]);
    await enqueue(tx, 'register', `register:${id}:${wallet.toLowerCase()}`, { id, wallet: wallet.toLowerCase() }, now);
    return { status: 'pending' };
  });
}
function shuffle<T>(items: T[]) { const copy = [...items]; for (let i = copy.length - 1; i > 0; i--) { const j = randomInt(i + 1); [copy[i], copy[j]] = [copy[j], copy[i]]; } return copy; }
interface OrderItem { questionId: string; options: string[] }
export async function startAttempt(id: string, wallet: string, db?: Database, now = Date.now()) {
  db ||= await database();
  const previous = await one(db, 'SELECT id FROM fl_attempts WHERE competition_id=? AND wallet=?', [id, wallet.toLowerCase()]);
  if (previous) return getAttempt(String(previous.id), wallet, db, now);
  const c = await competitionRow(id, db);
  ensure(Number(c.state) === 0 && now >= Number(c.start_at) && now + 120_000 <= Number(c.end_at), 'ENTRIES_CLOSED', 'This round is no longer accepting new runs.');
  const participant = await one(db, "SELECT * FROM fl_participants WHERE competition_id=? AND wallet=? AND status='confirmed'", [id, wallet.toLowerCase()]);
  ensure(participant, 'REGISTER_FIRST', 'Your onchain place must be confirmed before starting.', 409);
  const pack = await one(db, 'SELECT questions_json FROM fl_question_packs WHERE competition_id=?', [id]);
  ensure(pack, 'PACK_UNAVAILABLE', 'The question pack is temporarily unavailable.', 503);
  const questions = JSON.parse(String(pack.questions_json)) as Question[];
  const order: OrderItem[] = shuffle(questions).map(q => ({ questionId: q.id, options: shuffle(q.options.map(o => o.id)) }));
  const attemptId = randomUUID();
  await db.query('INSERT INTO fl_attempts(id,competition_id,wallet,started_at,deadline,state,order_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(competition_id,wallet) DO NOTHING', [attemptId, id, wallet.toLowerCase(), now, now + 120_000, 'active', JSON.stringify(order)]);
  const row = await one(db, 'SELECT id FROM fl_attempts WHERE competition_id=? AND wallet=?', [id, wallet.toLowerCase()]);
  return getAttempt(String(row!.id), wallet, db, now);
}
async function sealAttempt(tx: Executor, attempt: Row, now: number) {
  if (attempt.state !== 'active') return;
  const pack = await one(tx, 'SELECT questions_json FROM fl_question_packs WHERE competition_id=?', [String(attempt.competition_id)]);
  ensure(pack, 'PACK_UNAVAILABLE', 'Question pack unavailable.', 503);
  const questions = JSON.parse(String(pack.questions_json)) as Question[];
  const answers = (await tx.query('SELECT * FROM fl_answers WHERE attempt_id=? ORDER BY accepted_at', [String(attempt.id)])).rows;
  if (answers.length < 10 && now < Number(attempt.deadline)) return;
  const score = answers.reduce((sum, a) => sum + (questions.find(q => q.id === a.question_id)?.correctOption === a.option_id ? 10 : 0), 0);
  const elapsed = answers.length === 10 ? Math.max(0, Number(answers[answers.length - 1].accepted_at) - Number(attempt.started_at)) : 120_000;
  await tx.query('UPDATE fl_attempts SET state=?,score=?,elapsed_ms=? WHERE id=? AND state=?', [answers.length ? 'submitted' : 'abandoned', score, Math.min(120_000, elapsed), String(attempt.id), 'active']);
}
export async function getAttempt(attemptId: string, wallet: string, db?: Database, now = Date.now()): Promise<AttemptView> {
  db ||= await database();
  return db.transaction(async tx => {
    let a = await one(tx, 'SELECT * FROM fl_attempts WHERE id=? AND wallet=?' + (db.postgres ? ' FOR UPDATE' : ''), [attemptId, wallet.toLowerCase()]);
    ensure(a, 'NOT_FOUND', 'This run belongs to another wallet or does not exist.', 404);
    await sealAttempt(tx, a, now); a = (await one(tx, 'SELECT * FROM fl_attempts WHERE id=?', [attemptId]))!;
    const answers = (await tx.query('SELECT question_id FROM fl_answers WHERE attempt_id=?', [attemptId])).rows;
    const pack = await one(tx, 'SELECT questions_json FROM fl_question_packs WHERE competition_id=?', [String(a.competition_id)]);
    const order = JSON.parse(String(a.order_json)) as OrderItem[];
    const current = order[answers.length];
    const questions = JSON.parse(String(pack!.questions_json)) as Question[];
    const q = current ? questions.find(q => q.id === current.questionId) : undefined;
    return { id: attemptId, competitionId: String(a.competition_id), state: String(a.state), deadline: Number(a.deadline), serverNow: now, accepted: answers.length,
      question: a.state === 'active' && q && current ? { id: q.id, prompt: q.prompt, options: current.options.map(id => q.options.find(o => o.id === id)!) } : null };
  });
}
export async function answerAttempt(attemptId: string, wallet: string, questionId: string, optionId: string, requestKey: string, db?: Database, now = Date.now()) {
  db ||= await database();
  let expired = false;
  await db.transaction(async tx => {
    const a = await one(tx, 'SELECT * FROM fl_attempts WHERE id=? AND wallet=?' + (db.postgres ? ' FOR UPDATE' : ''), [attemptId, wallet.toLowerCase()]);
    ensure(a, 'NOT_FOUND', 'This run belongs to another wallet or does not exist.', 404);
    const prior = await one(tx, 'SELECT * FROM fl_answers WHERE attempt_id=? AND request_key=?', [attemptId, requestKey]);
    if (prior) { ensure(prior.question_id === questionId && prior.option_id === optionId, 'KEY_REUSED', 'An answer retry must match the original answer.', 409); return; }
    if (now >= Number(a.deadline)) { await sealAttempt(tx, a, now); expired = true; return; }
    ensure(a.state === 'active', 'RUN_FINISHED', 'This run has already been submitted.', 409);
    const answers = (await tx.query('SELECT * FROM fl_answers WHERE attempt_id=?', [attemptId])).rows;
    const current = (JSON.parse(String(a.order_json)) as OrderItem[])[answers.length];
    ensure(current?.questionId === questionId && current.options.includes(optionId), 'INVALID_ANSWER', 'That answer does not match the current question.', 409);
    await tx.query('INSERT INTO fl_answers(attempt_id,question_id,option_id,accepted_at,request_key) VALUES(?,?,?,?,?)', [attemptId, questionId, optionId, now, requestKey]);
    await sealAttempt(tx, a, now);
  });
  if (expired) ensure(false, 'TIME_UP', 'Time is up. Your accepted answers were submitted.', 409);
  return getAttempt(attemptId, wallet, db, now);
}
export async function finishExpiredAttempts(id: string, db: Database, now = Date.now()) {
  const rows = (await db.query("SELECT * FROM fl_attempts WHERE competition_id=? AND state='active'", [id])).rows;
  for (const a of rows) await db.transaction(async tx => {
    const current = await one(tx, 'SELECT * FROM fl_attempts WHERE id=?' + (db.postgres ? ' FOR UPDATE' : ''), [String(a.id)]);
    if (current) await sealAttempt(tx, current, now);
  });
}
export async function standingsFor(id: string, db?: Database): Promise<Standing[]> {
  db ||= await database();
  const c = await competitionRow(id, db);
  if (Date.now() < Number(c.end_at)) return [];
  await finishExpiredAttempts(id, db);
  const rows = (await db.query("SELECT * FROM fl_attempts WHERE competition_id=? AND state='submitted'", [id])).rows;
  const ranked = rankAttempts(rows.map(a => ({ wallet: getAddress(String(a.wallet)), score: Number(a.score), elapsedMs: Number(a.elapsed_ms), startedAt: Number(a.started_at) })));
  const amounts = allocatePool(BigInt(String(c.pool)), ranked.length);
  const rewards = (await db.query('SELECT * FROM fl_rewards WHERE competition_id=?', [id])).rows;
  return ranked.map((a, i) => { const r = rewards.find(r => String(r.wallet).toLowerCase() === a.wallet.toLowerCase()); return { ...a, rank: i + 1, reward: String(Number(c.state) === 1 ? r?.amount || '0' : Number(c.state) === 0 ? amounts[i]?.toString() || '0' : '0'), paid: Boolean(r?.tx_hash), txHash: r?.tx_hash as Hex | null || null }; });
}
export async function resultView(id: string) {
  const db = await database(); const c = await competitionRow(id, db);
  return { standings: await standingsFor(id, db), finalized: Number(c.state) === 1, settlementHash: c.settlement_hash,
    artifact: Date.now() >= Number(c.end_at) && c.result_json ? JSON.parse(String(c.result_json)) : null,
    serverNow: Date.now() };
}
export async function profileView(wallet: string) {
  const db = await database();
  const competitions = await listCompetitions(wallet);
  const history = competitions.filter(c => c.attemptId);
  const rewards = (await db.query("SELECT r.* FROM fl_rewards r WHERE wallet=? AND NOT EXISTS (SELECT 1 FROM fl_state s WHERE s.key='demo-round:' || r.competition_id)", [wallet.toLowerCase()])).rows;
  return { wallet: getAddress(wallet), history, rewards: rewards.filter(r => r.tx_hash), totalRewards: rewards.filter(r => r.tx_hash).reduce((s, r) => s + BigInt(String(r.amount)), 0n).toString() };
}
