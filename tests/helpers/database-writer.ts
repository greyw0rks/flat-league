import { createDatabase, one } from '../../src/server/database';
const db = createDatabase(process.argv[2]);
try {
  for (let i = 0; i < 20; i++) await db.transaction(async tx => {
    const prior = await one(tx, "SELECT value FROM fl_state WHERE key='counter'");
    await new Promise(resolve => setTimeout(resolve, 5));
    await tx.query("UPDATE fl_state SET value=? WHERE key='counter'", [String(Number(prior!.value) + 1)]);
  });
} finally { await db.close(); }
