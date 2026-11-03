import '../../src/server/load-env';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { createWalletClient, http, encodeFunctionData, keccak256, getAddress, type Hex, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { managerAbi } from '../../packages/contracts/managerAbi';
import { hashArtifact, hashPayouts, resultTypes, noContestTypes, rankAttempts, allocatePool, type Question, type Payout } from '../../packages/shared/domain';
import { database, one, type Database, type Row } from '../../src/server/database';
import { competitionRow, finishExpiredAttempts, enqueue, publishDraft } from '../../src/server/league';
import { chainClient, requireManager, confirmations } from '../../src/server/chain';
import { leagueChain, chainId } from '../../src/lib/config';

async function acquireLock(db: Database) {
  const token = `${Date.now() + 120_000}:${randomUUID()}`;
  return db.transaction(async tx => {
    await tx.query("INSERT INTO fl_state(key,value) VALUES('worker-lock','0') ON CONFLICT(key) DO NOTHING");
    const prior = (await one(tx, "SELECT value FROM fl_state WHERE key='worker-lock'"))!;
    if (Number(String(prior.value).split(':')[0]) > Date.now()) return null;
    const changed = await tx.query("UPDATE fl_state SET value=? WHERE key='worker-lock' AND value=?", [token, String(prior.value)]);
    return changed.count ? token : null;
  });
}
async function releaseLock(db: Database, token: string) { await db.query("UPDATE fl_state SET value='0' WHERE key='worker-lock' AND value=?", [token]); }

async function broadcastJob(db: Database, job: Row, data: Hex) {
  if (!process.env.RELAYER_PRIVATE_KEY) throw new Error('Relayer is not configured.');
  const account = privateKeyToAccount(process.env.RELAYER_PRIVATE_KEY as Hex);
  const client = chainClient();
  const wallet = createWalletClient({ account, chain: leagueChain, transport: http(process.env.RPC_URL || leagueChain.rpcUrls.default.http[0]) });
  let raw = job.raw_tx as Hex | null, hash = job.tx_hash as Hex | null;
  if (!raw || !hash) {
    const request = await wallet.prepareTransactionRequest({ to: requireManager(), data, account });
    raw = await wallet.signTransaction(request); hash = keccak256(raw);
    await db.query('UPDATE fl_jobs SET raw_tx=?,tx_hash=? WHERE id=?', [raw, hash, String(job.id)]);
  }
  try { await client.sendRawTransaction({ serializedTransaction: raw }); }
  catch (error) {
    // Already-known transactions are safe to watch; uncertain sends are retried using identical bytes.
    const text = error instanceof Error ? error.message : String(error);
    if (!/already known|nonce too low|already imported/i.test(text)) {
      try { await client.getTransactionReceipt({ hash }); } catch { throw error; }
    }
  }
  const receipt = await client.waitForTransactionReceipt({ hash, confirmations: confirmations(), timeout: 40_000 });
  if (receipt.status !== 'success') {
    // A confirmed revert consumed the nonce. A retry must sign a new transaction;
    // uncertain sends keep their original bytes for safe recovery.
    await db.query('UPDATE fl_jobs SET raw_tx=NULL,tx_hash=NULL WHERE id=?', [String(job.id)]);
    throw new Error('Relayer transaction reverted.');
  }
  return hash;
}

async function syncCompetitions(db: Database) {
  const client = chainClient(), manager = requireManager();
  const rows = (await db.query('SELECT * FROM fl_competitions ORDER BY created_at DESC LIMIT 100')).rows;
  const confirmedBlock = await client.getBlockNumber() - BigInt(confirmations() - 1);
  if (confirmedBlock < 0n) return;
  for (const c of rows) {
    const state = await client.readContract({ address: manager, abi: managerAbi, functionName: 'getCompetition', args: [BigInt(String(c.onchain_id))], blockNumber: confirmedBlock });
    await db.query('UPDATE fl_competitions SET state=? WHERE id=?', [state.status, String(c.id)]);
    const participants = (await db.query('SELECT * FROM fl_participants WHERE competition_id=?', [String(c.id)])).rows;
    for (const p of participants) {
      const registered = await client.readContract({ address: manager, abi: managerAbi, functionName: 'participants', args: [BigInt(String(c.onchain_id)), getAddress(String(p.wallet))], blockNumber: confirmedBlock });
      if (registered && p.status !== 'confirmed') await db.query("UPDATE fl_participants SET status='confirmed' WHERE competition_id=? AND wallet=?", [String(c.id), String(p.wallet)]);
      if (!registered && p.status === 'confirmed') await db.query("UPDATE fl_participants SET status='pending' WHERE competition_id=? AND wallet=?", [String(c.id), String(p.wallet)]);
    }
    if (state.status === 0 && Date.now() >= Number(c.end_at) && Date.now() < Number(c.finalize_by))
      await enqueue(db, 'settle', `settle:${c.id}`, { id: c.id });
  }
  const drafts = (await db.query('SELECT id,creator,rules_hash FROM fl_drafts WHERE published_id IS NULL ORDER BY created_at DESC LIMIT 100')).rows;
  // Recover a creator funding receipt if its browser closed before publication.
  const cursor = await one(db, "SELECT value FROM fl_state WHERE key='indexed-block'");
  const from = cursor ? BigInt(String(cursor.value)) : BigInt(process.env.DEPLOYMENT_BLOCK || '0');
  if (from <= confirmedBlock) {
    const to = from + 1000n < confirmedBlock ? from + 1000n : confirmedBlock;
    const logs = await client.getContractEvents({ address: manager, abi: managerAbi, eventName: 'CompetitionCreated', fromBlock: from, toBlock: to });
    for (const log of logs) {
      const draft = drafts.find(d => d.rules_hash === log.args.rulesHash && String(d.creator).toLowerCase() === log.args.creator?.toLowerCase());
      if (draft && log.transactionHash) await publishDraft(String(draft.creator), String(draft.id), log.transactionHash);
      if (log.transactionHash && log.blockHash) await db.query('INSERT INTO fl_chain_events(event_key,block_number,block_hash,tx_hash,kind) VALUES(?,?,?,?,?) ON CONFLICT(event_key) DO NOTHING', [`${log.transactionHash}:${log.logIndex}`, String(log.blockNumber), log.blockHash, log.transactionHash, 'created']);
    }
    // Re-read an overlap on subsequent ticks to tolerate shallow reorgs; read current state above as authority.
    await db.query("INSERT INTO fl_state(key,value) VALUES('indexed-block',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [(to > 5n ? to - 5n : 0n).toString()]);
  }
}

async function executeJob(db: Database, job: Row) {
  const payload = JSON.parse(String(job.payload)) as { id: string; wallet?: string };
  const c = await competitionRow(payload.id, db), id = BigInt(String(c.onchain_id));
  const client = chainClient(), address = requireManager();
  if (job.kind === 'register') {
    const player = getAddress(payload.wallet!);
    const registered = await client.readContract({ address, abi: managerAbi, functionName: 'participants', args: [id, player] });
    let hash = job.tx_hash as Hex | null;
    if (!registered) {
      if (Date.now() >= Number(c.end_at)) throw new Error('Registration window closed.');
      hash = await broadcastJob(db, job, encodeFunctionData({ abi: managerAbi, functionName: 'registerParticipant', args: [id, player] }));
    }
    await db.query("UPDATE fl_participants SET status='confirmed',tx_hash=? WHERE competition_id=? AND wallet=?", [hash, payload.id, payload.wallet!.toLowerCase()]);
    return;
  }
  if (job.kind === 'settle') {
    const onchain = await client.readContract({ address, abi: managerAbi, functionName: 'getCompetition', args: [id] });
    if (onchain.status === 2 || onchain.status === 3) return;
    await finishExpiredAttempts(payload.id, db);
    let artifact = c.result_json ? JSON.parse(String(c.result_json)) : null;
    let signature = c.signature as Hex | null;
    if (!artifact) {
      const attempts = (await db.query("SELECT * FROM fl_attempts WHERE competition_id=? AND state='submitted'", [payload.id])).rows;
      const ranked = rankAttempts(attempts.map(a => ({ wallet: getAddress(String(a.wallet)), score: Number(a.score), elapsedMs: Number(a.elapsed_ms), startedAt: Number(a.started_at), attemptId: String(a.id) })));
      const amounts = allocatePool(BigInt(String(c.pool)), ranked.length);
      const payouts = ranked.slice(0, 3).map((a, index) => ({ winner: a.wallet, score: a.score, elapsedMs: a.elapsedMs, amount: amounts[index].toString() }));
      const pack = await one(db, 'SELECT * FROM fl_question_packs WHERE competition_id=?', [payload.id]);
      const draft = await one(db, 'SELECT rules_json FROM fl_drafts WHERE published_id=?', [payload.id]);
      const transcripts = [];
      for (const a of ranked) transcripts.push({ ...a, answers: (await db.query('SELECT question_id,option_id,accepted_at FROM fl_answers WHERE attempt_id=? ORDER BY accepted_at', [a.attemptId])).rows });
      artifact = { version: 1, competitionId: payload.id, onchainId: id.toString(), rulesHash: c.rules_hash, rules: draft ? JSON.parse(String(draft.rules_json)) : null, questions: JSON.parse(String(pack!.questions_json)) as Question[], salt: pack!.salt, transcripts, payouts };
      if (!process.env.RESULT_SIGNER_KEY) throw new Error('Result signer is not configured.');
      const signer = privateKeyToAccount(process.env.RESULT_SIGNER_KEY as Hex);
      if (signer.address.toLowerCase() !== onchain.resultSigner.toLowerCase()) throw new Error('Wrong result signer for this competition.');
      const domain = { name: 'FlatLeague', version: '1', chainId, verifyingContract: address };
      const base = { competitionId: id, rulesHash: c.rules_hash as Hex, resultArtifactHash: hashArtifact(artifact), nonce: await client.readContract({ address, abi: managerAbi, functionName: 'resultNonce', args: [id] }), validUntil: onchain.finalizeBy };
      signature = payouts.length ? await signer.signTypedData({ domain, types: resultTypes, primaryType: 'Result', message: { ...base, payoutsHash: hashPayouts(payouts.map((p: { winner: Address; score: number; elapsedMs: number; amount: string }) => ({ ...p, amount: BigInt(p.amount) }))) } }) : await signer.signTypedData({ domain, types: noContestTypes, primaryType: 'NoContest', message: base });
      await db.query('UPDATE fl_competitions SET result_json=?,signature=? WHERE id=? AND result_json IS NULL', [JSON.stringify(artifact), signature, payload.id]);
    }
    const payouts: Payout[] = artifact.payouts.map((p: { winner: Address; score: number; elapsedMs: number; amount: string }) => ({ ...p, amount: BigInt(p.amount) }));
    const base = { competitionId: id, rulesHash: c.rules_hash as Hex, resultArtifactHash: hashArtifact(artifact), nonce: 0n, validUntil: onchain.finalizeBy };
    let hash = job.tx_hash as Hex | null;
    if (onchain.status === 0) {
      const data = payouts.length ? encodeFunctionData({ abi: managerAbi, functionName: 'finalizeCompetition', args: [id, { ...base, payoutsHash: hashPayouts(payouts) }, payouts, signature!] }) : encodeFunctionData({ abi: managerAbi, functionName: 'refundNoContest', args: [id, base, signature!] });
      hash = await broadcastJob(db, job, data);
    }
    await db.transaction(async tx => {
      await tx.query('UPDATE fl_competitions SET state=?,settlement_hash=? WHERE id=?', [payouts.length ? 1 : 3, hash, payload.id]);
      for (const p of payouts) {
        await tx.query('INSERT INTO fl_rewards(competition_id,wallet,amount) VALUES(?,?,?) ON CONFLICT(competition_id,wallet) DO NOTHING', [payload.id, p.winner.toLowerCase(), p.amount.toString()]);
        if (p.amount > 0n) await enqueue(tx, 'pay', `pay:${payload.id}:${p.winner.toLowerCase()}`, { id: payload.id, wallet: p.winner.toLowerCase() });
      }
    });
    return;
  }
  if (job.kind === 'pay') {
    const winner = getAddress(payload.wallet!);
    const amount = await client.readContract({ address, abi: managerAbi, functionName: 'claimable', args: [id, winner] });
    let hash = job.tx_hash as Hex | null;
    if (amount > 0n) hash = await broadcastJob(db, job, encodeFunctionData({ abi: managerAbi, functionName: 'claimFor', args: [id, winner] }));
    if (!hash) {
      const logs = await client.getContractEvents({ address, abi: managerAbi, eventName: 'RewardClaimed', args: { id, winner }, fromBlock: BigInt(process.env.DEPLOYMENT_BLOCK || '0') });
      hash = logs.at(-1)?.transactionHash || null;
    }
    if (!hash) throw new Error('Reward receipt not yet found.');
    const receipt = await client.getTransactionReceipt({ hash });
    if (receipt.status !== 'success') throw new Error('Reward transfer did not succeed.');
    await db.query('UPDATE fl_rewards SET tx_hash=? WHERE competition_id=? AND wallet=?', [hash, payload.id, winner.toLowerCase()]);
  }
}

export async function tick() {
  const db = await database(); const token = await acquireLock(db); if (!token) return;
  try {
    await syncCompetitions(db);
    const now = Date.now();
    const job = await one(db, "SELECT * FROM fl_jobs WHERE status!='done' AND status!='failed' AND next_at<=? AND lease_until<? ORDER BY next_at LIMIT 1", [now, now]);
    if (!job) return;
    await db.query("UPDATE fl_jobs SET status='working',lease_until=?,lease_token=?,attempts=attempts+1 WHERE id=?", [now + 90_000, token, String(job.id)]);
    try { await executeJob(db, job); await db.query("UPDATE fl_jobs SET status='done',lease_until=0,last_error=NULL WHERE id=?", [String(job.id)]); }
    catch (error) {
      const attempts = Number(job.attempts) + 1;
      const message = error instanceof Error ? error.message.split('\n')[0] : 'Worker job failed';
      await db.query('UPDATE fl_jobs SET status=?,lease_until=0,next_at=?,last_error=? WHERE id=?', [attempts >= 12 ? 'failed' : 'ready', now + Math.min(60_000, 1000 * 2 ** attempts), message.slice(0, 180), String(job.id)]);
      console.error(`[${job.kind}] ${message}`);
    }
  } finally {
    await db.query("INSERT INTO fl_state(key,value) VALUES('worker-heartbeat',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", [String(Date.now())]);
    await db.query('DELETE FROM fl_rate_limits WHERE expires_at<?', [Date.now()]);
    await db.query('DELETE FROM fl_nonces WHERE expires_at<?', [Date.now() - 3600_000]);
    await releaseLock(db, token);
  }
}

async function main() {
  if (!process.env.RELAYER_PRIVATE_KEY || !process.env.RESULT_SIGNER_KEY) throw new Error('Configure relayer and result signer before starting the worker.');
  const once = process.argv.includes('--once');
  let stopping = false;
  for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { stopping = true; });
  try {
    do { try { await tick(); } catch (e) { console.error(e instanceof Error ? e.message.split('\n')[0] : 'Worker error'); if (once) throw e; } if (!once && !stopping) await new Promise(r => setTimeout(r, 2000)); } while (!once && !stopping);
  } finally { await (await database()).close(); }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().catch(e => { console.error(e.message); process.exitCode = 1; });
