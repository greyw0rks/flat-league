import '../src/server/load-env';
const { chainId } = await import('../src/lib/config');
if (chainId !== 31337) throw new Error('This cleanup targets only the retained local Anvil verification fixtures.');
const { database } = await import('../src/server/database');
const { markDemoCompetition, listCompetitions } = await import('../src/server/league');
const db = await database();
// These exact descriptions and Anvil's published creator identify the local
// fixture source, rather than hiding user rounds based on a title keyword.
const rows = await db.query('SELECT id FROM fl_competitions WHERE creator=? AND description IN (?,?)', [
  '0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266',
  'A public sample round in the local MockWIF playground. Ten questions, two minutes, and a place on the podium.',
  'Local browser verification of creator funding, a timed run, settlement, and a real MockWIF transfer.'
]);
for (const row of rows.rows) await markDemoCompetition(String(row.id), db);
console.log(JSON.stringify({ hiddenLocalFixtures: rows.rows.length, publicRounds: (await listCompetitions(undefined, db)).length }));
await db.close();
