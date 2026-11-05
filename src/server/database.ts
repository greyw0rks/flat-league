import { DatabaseSync } from 'node:sqlite';
import { Pool, type PoolClient } from 'pg';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { schemaStatements, privateTables } from './schema';

export type Row = Record<string, string | number | null>;
export interface QueryResult { rows: Row[]; count: number }
export interface Executor { query(sql: string, args?: (string | number | null)[]): Promise<QueryResult> }
export interface Database extends Executor { transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>; close(): Promise<void>; postgres: boolean }

type SqliteQueue = { tail: Promise<unknown>; users: number };
// Separate clients in the same Node process must take turns too: waiting for
// SQLite's writer lock synchronously would prevent the other client committing.
const processState = globalThis as typeof globalThis & { flatLeagueSqliteQueues?: Map<string, SqliteQueue> };
const sqliteQueues = processState.flatLeagueSqliteQueues ||= new Map<string, SqliteQueue>();
// Bump when schemaStatements changes. Next can load the server in multiple
// processes; unchanged local schemas should not acquire a migration write lock.
const sqliteSchemaVersion = 1;

const pgSql = (sql: string) => {
  let index = 0;
  let converted = sql.replace(/\?/g, () => '$' + ++index);
  for (const table of privateTables) converted = converted.replace(new RegExp('\\b' + table + '\\b', 'g'), 'private.' + table);
  return converted;
};
export function createDatabase(url: string): Database {
  if (/^postgres(ql)?:/.test(url)) {
    const pool = new Pool({ connectionString: url, max: 5 });
    const executor = (client: Pool | PoolClient): Executor => ({ query: async (sql, args = []) => {
      const res = await client.query(pgSql(sql), args); return { rows: res.rows as Row[], count: res.rowCount || 0 };
    } });
    return { ...executor(pool), postgres: true,
      transaction: async fn => { const client = await pool.connect(); try { await client.query('BEGIN'); const value = await fn(executor(client)); await client.query('COMMIT'); return value; } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); } },
      close: () => pool.end()
    };
  }
  if (!url.startsWith('file:')) throw new Error('Use a file: development database or a PostgreSQL connection URL.');
  if (url !== 'file::memory:') mkdirSync(dirname(resolve(url.slice(5))), { recursive: true });
  const memory = url === 'file::memory:';
  const file = memory ? ':memory:' : resolve(url.slice(5));
  const client = new DatabaseSync(file);
  const queue = memory ? { tail: Promise.resolve(), users: 0 } : sqliteQueues.get(file) || { tail: Promise.resolve(), users: 0 };
  queue.users++;
  if (!memory) sqliteQueues.set(file, queue);
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = queue.tail.then(fn); queue.tail = result.catch(() => {}); return result;
  };
  // Native statements are fully consumed before returning. Keep one connection
  // per client and configure cross-process lock waits on that connection.
  void serial(async () => {
    client.exec('PRAGMA busy_timeout=5000');
    if (!memory) client.exec('PRAGMA journal_mode=WAL');
  });
  const executor: Executor = { query: async (sql, args = []) => {
    const statement = client.prepare(sql);
    if (statement.columns().length) return { rows: statement.all(...args) as Row[], count: 0 };
    return { rows: [], count: Number(statement.run(...args).changes) };
  } };
  let closed = false;
  return { query: (sql, args) => serial(() => executor.query(sql, args)), postgres: false,
    transaction: fn => serial(async () => {
      client.exec('BEGIN IMMEDIATE');
      try { const value = await fn(executor); client.exec('COMMIT'); return value; }
      catch (e) { client.exec('ROLLBACK'); throw e; }
    }),
    close: () => serial(async () => {
      if (closed) return;
      client.close(); closed = true;
      if (--queue.users === 0 && !memory) sqliteQueues.delete(file);
    })
  };
}
export async function migrate(db: Database) {
  // Publish the schema and its permissions together. Supabase can grant table
  // access to API roles by default; revoking PUBLIC alone does not remove it.
  await db.transaction(async tx => {
    if (db.postgres) await tx.query('CREATE SCHEMA IF NOT EXISTS private');
    for (const statement of schemaStatements) await tx.query(statement);
    if (!db.postgres) { await tx.query('PRAGMA user_version=' + sqliteSchemaVersion); return; }
    const roles = (await tx.query("SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated')")).rows;
    const grantees = ['PUBLIC', ...roles.map(r => `"${String(r.rolname)}"`)].join(', ');
    await tx.query(`REVOKE ALL ON SCHEMA private FROM ${grantees}`);
    await tx.query(`ALTER DEFAULT PRIVILEGES IN SCHEMA private REVOKE ALL ON TABLES FROM ${grantees}`);
    for (const statement of schemaStatements.filter(s => s.startsWith('CREATE TABLE'))) {
      const table = statement.match(/EXISTS (\w+)/)![1];
      await tx.query(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
      await tx.query(`REVOKE ALL ON ${table} FROM ${grantees}`);
    }
  });
}
let singleton: Promise<Database> | undefined;
export function database(): Promise<Database> {
  if (!singleton) singleton = (async () => {
    const db = createDatabase(process.env.DATABASE_URL || 'file:.data/flat-league.db');
    if (!db.postgres && Number((await one(db, 'PRAGMA user_version'))?.user_version) !== sqliteSchemaVersion) await migrate(db);
    return db;
  })();
  return singleton;
}
export async function one(db: Executor, sql: string, args: (string | number | null)[] = []) { return (await db.query(sql, args)).rows[0] || null; }
