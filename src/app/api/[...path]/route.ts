import 'server-only';
import { z, ZodError } from 'zod';
import { isAddress, type Hex } from 'viem';
import { issueNonce, verifyLogin, sessionWallet, requireOrigin, rateLimit, appUrl, digest } from '@/server/auth';
import { database, one } from '@/server/database';
import { AppError, ensure } from '@/server/errors';
import { listCompetitions, getCompetition, createDraft, publishDraft, joinCompetition, startAttempt, getAttempt, answerAttempt, resultView, profileView, enqueue } from '@/server/league';
import { configured, chainId, currencyLabel } from '@/lib/config';
import { scheduleHostedWorker } from '@/server/hosted-worker';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;
const signatureSchema = z.object({ message: z.string().max(2500), signature: z.string().regex(/^0x[0-9a-fA-F]+$/).max(2000) });
async function body(request: Request) {
  const text = await request.text(); ensure(text.length <= 64_000, 'TOO_LARGE', 'This request is too large.', 413);
  try { return JSON.parse(text || '{}'); } catch { throw new AppError('INVALID_JSON', 'The request could not be read.'); }
}
const reply = (data: unknown, status = 200, headers?: HeadersInit) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

async function handle(request: Request, context: { params: Promise<{ path: string[] }> }) {
  try {
    const { path } = await context.params;
    const [resource, id, action] = path;
    const get = request.method === 'GET';
    if (!get) await requireOrigin(request);
    await rateLimit(request, resource === 'auth' ? 'auth' : 'api', resource === 'auth' ? 30 : 120);
    if (resource === 'competitions' || resource === 'attempts' || resource === 'competition-drafts') scheduleHostedWorker();
    if (get && resource === 'health') {
      const db = await database(), heartbeat = await one(db, "SELECT value FROM fl_state WHERE key='worker-heartbeat'");
      return reply({ ready: true, configured, chainId, currency: currencyLabel, workerHealthy: heartbeat ? Date.now() - Number(heartbeat.value) < (process.env.FLAT_HOSTED_WORKER === 'true' ? 900_000 : 60_000) : false, serverNow: Date.now() });
    }
    if (resource === 'auth') {
      if (get && id === 'nonce') return reply(await issueNonce());
      if (get && id === 'me') return reply({ wallet: await sessionWallet(request, false) || null });
      if (!get && id === 'verify') {
        const input = signatureSchema.parse(await body(request));
        const session = await verifyLogin(input.message, input.signature as Hex);
        return reply({ wallet: session.wallet }, 200, { 'Set-Cookie': `fl_session=${session.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=43200${appUrl().protocol === 'https:' ? '; Secure' : ''}` });
      }
      if (!get && id === 'logout') {
        const cookie = request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('fl_session='))?.slice(11);
        if (cookie) await (await database()).query('DELETE FROM fl_sessions WHERE token_hash=?', [digest(cookie)]);
        return reply({ ok: true }, 200, { 'Set-Cookie': 'fl_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0' });
      }
    }
    if (get && resource === 'competitions') {
      const wallet = await sessionWallet(request, false);
      if (!id) return reply({ competitions: await listCompetitions(wallet), serverNow: Date.now() });
      if (action === 'results') return reply(await resultView(id));
      return reply({ competition: await getCompetition(id, wallet), serverNow: Date.now() });
    }
    if (get && resource === 'profile' && id) {
      ensure(isAddress(id), 'INVALID_WALLET', 'This wallet address is invalid.'); return reply(await profileView(id));
    }
    if (get && resource === 'leaderboard') {
      const db = await database();
      const competitions = await listCompetitions();
      const points = new Map<string, { wallet: string; points: number; wins: number; rounds: number }>();
      for (const c of competitions.filter(c => c.status === 'finalized')) {
        const { standings } = await resultView(c.id);
        for (const s of standings) {
          const item = points.get(s.wallet) || { wallet: s.wallet, points: 0, wins: 0, rounds: 0 };
          item.points += [10, 6, 4][s.rank - 1] || 1; item.rounds++; if (s.rank === 1) item.wins++;
          points.set(s.wallet, item);
        }
      }
      return reply({ players: [...points.values()].sort((a, b) => b.points - a.points || a.wallet.localeCompare(b.wallet)), finalizedOnly: true });
    }
    const wallet = (await sessionWallet(request))!;
    if (resource === 'competition-drafts' && !get) {
      if (!id) return reply(await createDraft(wallet, await body(request)), 201);
      if (action === 'publish') {
        const input = z.object({ hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/) }).parse(await body(request));
        return reply(await publishDraft(wallet, id, input.hash as Hex));
      }
    }
    if (resource === 'competitions' && id && !get) {
      if (action === 'join') return reply(await joinCompetition(id, wallet), 202);
      if (action === 'attempts') return reply(await startAttempt(id, wallet), 201);
      if (action === 'rewards') {
        const db = await database(), reward = await one(db, 'SELECT * FROM fl_rewards WHERE competition_id=? AND wallet=?', [id, wallet]);
        ensure(reward && BigInt(String(reward.amount)) > 0n, 'NO_REWARD', 'There is no allocated reward for this wallet.');
        await enqueue(db, 'pay', `pay:${id}:${wallet}`, { id, wallet });
        await db.query("UPDATE fl_jobs SET status='ready',attempts=0,next_at=? WHERE effect_key=? AND status='failed'", [Date.now(), `pay:${id}:${wallet}`]);
        return reply({ status: reward.tx_hash ? 'confirmed' : 'pending' }, 202);
      }
    }
    if (resource === 'attempts' && id) {
      if (get || action === 'finish') return reply(await getAttempt(id, wallet));
      if (action === 'answers') {
        const input = z.object({ questionId: z.string().min(1).max(40), optionId: z.string().min(1).max(40), requestKey: z.string().uuid() }).parse(await body(request));
        return reply(await answerAttempt(id, wallet, input.questionId, input.optionId, input.requestKey));
      }
    }
    throw new AppError('NOT_FOUND', 'This endpoint does not exist.', 404);
  } catch (error) {
    if (error instanceof AppError) return reply({ error: error.code, message: error.message }, error.status);
    if (error instanceof ZodError) return reply({ error: 'VALIDATION', message: error.issues[0]?.message || 'Check your inputs.' }, 400);
    console.error('Flat League API error:', error instanceof Error ? error.name : 'UnknownError',
      error && typeof error === 'object' && 'code' in error ? String(error.code) : '');
    // Native SQLite diagnostics contain schema/engine errors, not bound values.
    if (error instanceof Error && 'code' in error && error.code === 'ERR_SQLITE_ERROR') console.error('SQLite:', error.message);
    return reply({ error: 'UNAVAILABLE', message: 'The service is temporarily unavailable. Please try again.' }, 503);
  }
}
export const GET = handle;
export const POST = handle;
export const PATCH = handle;
