import { database, one } from '../../src/server/database';
process.env.DATABASE_URL = process.argv[2];
const db = await database();
try { console.log((await one(db, "SELECT value FROM fl_state WHERE key='counter'"))!.value); }
finally { await db.close(); }
