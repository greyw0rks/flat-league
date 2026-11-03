import { createClient, type Client as SqliteClient, type Transaction as SqliteTransaction } from '@libsql/client';
import { Pool, type PoolClient } from 'pg';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { schemaStatements, privateTables } from './schema';

export type Row = Record<string, string | number | null>;
export interface QueryResult { rows: Row[]; count: number }
export interface Executor { query(sql: string, args?: (string | number | null)[]): Promise<QueryResult> }
export interface Database extends Executor { transaction<T>(fn: (tx: Executor) => Promise<T>): Promise<T>; close(): Promise<void>; postgres: boolean }

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
  const client: SqliteClient = createClient({ url });
  // A libSQL client shares its connection with transactions. Queue top-level
  // operations so concurrent HTTP requests cannot run inside another request's transaction.
  let tail: Promise<unknown> = (async () => {
    await client.execute('PRAGMA busy_timeout=5000');
    if (url !== 'file::memory:') await client.execute('PRAGMA journal_mode=WAL');
  })();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => {
    const result = tail.then(fn); tail = result.catch(() => {}); return result;
  };
  const executor = (db: SqliteClient | SqliteTransaction): Executor => ({ query: async (sql, args = []) => {
    const res = await db.execute({ sql, args });
    return { rows: res.rows as unknown as Row[], count: res.rowsAffected };
  } });
  return { query: (sql, args) => serial(() => executor(client).query(sql, args)), postgres: false,
    transaction: fn => serial(async () => { const tx = await client.transaction('write'); try { const value = await fn(executor(tx)); await tx.commit(); return value; } catch (e) { await tx.rollback(); throw e; } finally { tx.close(); } }),
    close: async () => { await tail; client.close(); }
  };
}
export async function migrate(db: Database) {
  // Publish the schema and its permissions together. Supabase can grant table
  // access to API roles by default; revoking PUBLIC alone does not remove it.
  await db.transaction(async tx => {
    if (db.postgres) await tx.query('CREATE SCHEMA IF NOT EXISTS private');
    for (const statement of schemaStatements) await tx.query(statement);
    if (!db.postgres) return;
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
    if (!db.postgres) await migrate(db);
    return db;
  })();
  return singleton;
}
export async function one(db: Executor, sql: string, args: (string | number | null)[] = []) { return (await db.query(sql, args)).rows[0] || null; }
