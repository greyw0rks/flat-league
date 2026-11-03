import { spawn } from 'node:child_process';
import { mkdirSync, openSync, closeSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

mkdirSync('.data/runtime', { recursive: true });
const start = (name: string, args: string[]) => {
  const fd = openSync(`.data/runtime/${name}.log`, 'a');
  const child = spawn(process.execPath, args, { cwd: process.cwd(), detached: true, stdio: ['ignore', fd, fd] });
  closeSync(fd); child.unref();
  writeFileSync(`.data/runtime/${name}.pid`, String(child.pid) + '\n');
  console.log(`${name} started (${child.pid}); log: .data/runtime/${name}.log`);
};
const check = async (url: string) => { try { await fetch(url, { signal: AbortSignal.timeout(1000) }); return true; } catch { return false; } };
const running = (name: string, entry: string) => {
  try {
    const pid = Number(readFileSync(`.data/runtime/${name}.pid`, 'utf8').trim());
    return pid > 0 && readFileSync(`/proc/${pid}/cmdline`, 'utf8').includes(resolve(entry));
  } catch { return false; }
};
if (!await check('http://127.0.0.1:8547')) start('chain', ['--import', 'tsx', resolve('scripts/local-chain.ts')]);
else console.log('Local chain is already listening on 8547.');
const workerRunning = running('worker', 'apps/worker/main.ts');
const health = await check('http://localhost:3020/api/health');
if (!health) start('web', [resolve('node_modules/next/dist/bin/next'), 'start', '--hostname', '0.0.0.0', '--port', '3020']);
else console.log('Web app is already listening on 3020.');
let workerHealthy = false;
try { workerHealthy = (await (await fetch('http://localhost:3020/api/health', { signal: AbortSignal.timeout(1000) })).json()).workerHealthy; } catch { /* start below */ }
if (!workerHealthy && !workerRunning) start('worker', ['--import', 'tsx', resolve('apps/worker/main.ts')]);
else console.log('Worker heartbeat is healthy.');
