import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { createPublicClient, http } from 'viem';

mkdirSync('.data', { recursive: true });
const foundry = `${homedir()}/.foundry/bin/anvil`;
const child = spawn(process.env.ANVIL_BIN || (existsSync(foundry) ? foundry : 'anvil'), ['--host', '127.0.0.1', '--port', '8547', '--chain-id', '31337', '--block-time', '1', '--state', '.data/anvil-state.json', '--state-interval', '5', '--silent'], { stdio: 'inherit' });
const stopped = new Promise<void>((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', code => code === 0 || code === null ? resolve() : reject(new Error(`Anvil exited with status ${code}`)));
});
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
const client = createPublicClient({ transport: http('http://127.0.0.1:8547', { retryCount: 0, timeout: 1000 }) });
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    if (child.exitCode !== null) throw new Error('Anvil could not start. Check port 8547.');
    try { if (await client.getChainId() !== 31337) throw new Error('Wrong chain on local port.'); ready = true; break; } catch { await new Promise(resolve => setTimeout(resolve, 250)); }
  }
  if (!ready) throw new Error('Local Anvil did not become ready.');
  // Restoring saved state preserves the old timestamp. Align the local chain
  // with the server's clock before time-sensitive registration and settlement.
  const block = await client.getBlock();
  const now = Math.floor(Date.now() / 1000);
  if (Number(block.timestamp) < now) {
    await client.request({ method: 'evm_setNextBlockTimestamp', params: [now] } as never);
    await client.request({ method: 'evm_mine' } as never);
  }
  console.log('Local Anvil ready on 127.0.0.1:8547; saved state restored and clock synchronized.');
  await stopped;
} catch (error) {
  child.kill('SIGINT'); await stopped.catch(() => {}); throw error;
}
