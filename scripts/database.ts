import '../src/server/load-env';
const { database, migrate } = await import('../src/server/database');
const db = await database(); await migrate(db); console.log('Flat League database migrated.'); await db.close();
