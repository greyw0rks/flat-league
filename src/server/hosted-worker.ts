import { after } from 'next/server';
import { tick } from '../../apps/worker/main';
import { configured } from '../lib/config';

export function scheduleHostedWorker() {
  if (!configured || process.env.FLAT_HOSTED_WORKER !== 'true') return;
  after(async () => {
    try { await tick(); }
    catch { console.error('Hosted Flat League worker cycle failed; retained jobs will be retried.'); }
  });
}
