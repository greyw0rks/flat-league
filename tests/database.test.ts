import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createDatabase, migrate, one } from '../src/server/database';

test('two clients in one process serialize yielded transactions and preserve rollback', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'flat-league-shared-db-'));
  const url = 'file:' + join(dir, 'test.db');
  const app = createDatabase(url), worker = createDatabase(url);
  try {
    await migrate(app);
    await app.query("INSERT INTO fl_state(key,value) VALUES('counter','0')");
    await Promise.all(Array.from({ length: 80 }, (_, index) => (index % 2 ? app : worker).transaction(async tx => {
      const prior = await one(tx, "SELECT value FROM fl_state WHERE key='counter'");
      await new Promise(resolve => setTimeout(resolve, 1));
      await tx.query("UPDATE fl_state SET value=? WHERE key='counter'", [String(Number(prior!.value) + 1)]);
    })));
    await assert.rejects(worker.transaction(async tx => {
      await tx.query("UPDATE fl_state SET value='-1' WHERE key='counter'");
      throw new Error('rollback test');
    }), /rollback test/);
    assert.equal(Number((await one(app, "SELECT value FROM fl_state WHERE key='counter'"))!.value), 80);
    await worker.close();
    await app.query("UPDATE fl_state SET value='81' WHERE key='counter'");
    assert.equal(Number((await one(app, "SELECT value FROM fl_state WHERE key='counter'"))!.value), 81);
  } finally { await worker.close(); await app.close(); rmSync(dir, { recursive: true }); }
});

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

test('a fresh server reads the existing schema while another process holds a write transaction', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'flat-league-startup-db-'));
  const url = 'file:' + join(dir, 'test.db'), db = createDatabase(url);
  try {
    await migrate(db);
    await db.query("INSERT INTO fl_state(key,value) VALUES('counter','0')");
    await db.transaction(async tx => {
      await tx.query("UPDATE fl_state SET value='1' WHERE key='counter'");
      const output = await new Promise<string>((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(new URL('./helpers/database-reader.ts', import.meta.url)), url], { stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '', stderr = '';
        child.stdout.on('data', chunk => { stdout += chunk; });
        child.stderr.on('data', chunk => { stderr += chunk; });
        const timeout = setTimeout(() => { child.kill('SIGTERM'); reject(new Error('Startup tried to acquire the existing write lock.')); }, 3000);
        child.once('error', error => { clearTimeout(timeout); reject(error); });
        child.once('exit', code => { clearTimeout(timeout); code === 0 ? resolve(stdout.trim()) : reject(new Error(stderr || `Reader exited ${code}`)); });
      });
      assert.equal(output, '0', 'The new server can read the committed snapshot before the writer finishes.');
    });
    assert.equal((await one(db, "SELECT value FROM fl_state WHERE key='counter'"))!.value, '1');
  } finally { await db.close(); rmSync(dir, { recursive: true }); }
});
