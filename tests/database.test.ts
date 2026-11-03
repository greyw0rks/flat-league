import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, migrate, one } from '../src/server/database';

test('independent app/worker processes share SQLite without lost writes or lock failures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'flat-league-db-'));
  const url = 'file:' + join(dir, 'test.db'), db = createDatabase(url); await migrate(db);
  await db.query("INSERT INTO fl_state(key,value) VALUES('counter','0')");
  const run = () => new Promise<void>((resolve, reject) => {
    const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./helpers/database-writer.ts', import.meta.url)), url], { stdio: ['ignore', 'ignore', 'pipe'] });
    let output = ''; child.stderr.on('data', chunk => { output += chunk; });
    child.once('error', reject); child.once('exit', code => code === 0 ? resolve() : reject(new Error(output || `Writer exited ${code}`)));
  });
  try {
    const results = await Promise.allSettled([run(), run()]);
    for (const result of results) if (result.status === 'rejected') throw result.reason;
    assert.equal(Number((await one(db, "SELECT value FROM fl_state WHERE key='counter'"))!.value), 40);
  } finally { await db.close(); rmSync(dir, { recursive: true }); }
});
