import '../../src/server/load-env';
import { database } from '../../src/server/database';
const db=await database();
console.log(JSON.stringify({state:(await db.query("SELECT key,value FROM fl_state WHERE key IN ('worker-lock','worker-heartbeat')")).rows,jobs:(await db.query("SELECT kind,status,attempts,last_error,next_at,lease_until,tx_hash FROM fl_jobs WHERE status!='done' ORDER BY next_at LIMIT 20")).rows},null,2));
await db.close();
