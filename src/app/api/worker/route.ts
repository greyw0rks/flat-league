import { timingSafeEqual } from 'node:crypto';
import { tick } from '../../../../apps/worker/main';
import { configured } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request: Request) {
  const expected = Buffer.from(process.env.CRON_SECRET || '');
  const actual = Buffer.from(request.headers.get('authorization')?.replace(/^Bearer /, '') || '');
  if (!expected.length || expected.length !== actual.length || !timingSafeEqual(expected, actual)) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  if (!configured) return Response.json({ error: 'Testnet contracts are not configured' }, { status: 503 });
  await tick();
  return Response.json({ processed: true, checkedAt: new Date().toISOString() }, { headers: { 'Cache-Control': 'no-store' } });
}
