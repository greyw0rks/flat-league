export const schemaStatements = [
  `CREATE TABLE IF NOT EXISTS fl_competitions (id TEXT PRIMARY KEY, onchain_id TEXT NOT NULL UNIQUE, creator TEXT NOT NULL, title TEXT NOT NULL, description TEXT NOT NULL, pool TEXT NOT NULL, start_at BIGINT NOT NULL, end_at BIGINT NOT NULL, finalize_by BIGINT NOT NULL, max_participants INTEGER NOT NULL, rules_hash TEXT NOT NULL, question_commitment TEXT NOT NULL, result_signer TEXT NOT NULL, registrar TEXT NOT NULL, funding_hash TEXT NOT NULL, state INTEGER NOT NULL DEFAULT 0, settlement_hash TEXT, result_json TEXT, signature TEXT, created_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fl_question_packs (competition_id TEXT PRIMARY KEY, questions_json TEXT NOT NULL, salt TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fl_drafts (id TEXT PRIMARY KEY, creator TEXT NOT NULL, input_json TEXT NOT NULL, salt TEXT NOT NULL, rules_json TEXT NOT NULL, rules_hash TEXT NOT NULL, question_commitment TEXT NOT NULL, created_at BIGINT NOT NULL, published_id TEXT)`,
  `CREATE TABLE IF NOT EXISTS fl_participants (competition_id TEXT NOT NULL, wallet TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', tx_hash TEXT, created_at BIGINT NOT NULL, PRIMARY KEY(competition_id,wallet))`,
  `CREATE TABLE IF NOT EXISTS fl_attempts (id TEXT PRIMARY KEY, competition_id TEXT NOT NULL, wallet TEXT NOT NULL, started_at BIGINT NOT NULL, deadline BIGINT NOT NULL, state TEXT NOT NULL, order_json TEXT NOT NULL, score INTEGER, elapsed_ms INTEGER, UNIQUE(competition_id,wallet))`,
  `CREATE TABLE IF NOT EXISTS fl_answers (attempt_id TEXT NOT NULL, question_id TEXT NOT NULL, option_id TEXT NOT NULL, accepted_at BIGINT NOT NULL, request_key TEXT NOT NULL, PRIMARY KEY(attempt_id,question_id), UNIQUE(attempt_id,request_key))`,
  `CREATE TABLE IF NOT EXISTS fl_rewards (competition_id TEXT NOT NULL, wallet TEXT NOT NULL, amount TEXT NOT NULL, tx_hash TEXT, PRIMARY KEY(competition_id,wallet))`,
  `CREATE TABLE IF NOT EXISTS fl_nonces (nonce_hash TEXT PRIMARY KEY, expires_at BIGINT NOT NULL, consumed INTEGER NOT NULL DEFAULT 0)`,
  `CREATE TABLE IF NOT EXISTS fl_sessions (token_hash TEXT PRIMARY KEY, wallet TEXT NOT NULL, expires_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fl_jobs (id TEXT PRIMARY KEY, effect_key TEXT NOT NULL UNIQUE, kind TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, lease_token TEXT, lease_until BIGINT NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0, next_at BIGINT NOT NULL, tx_hash TEXT, raw_tx TEXT, last_error TEXT)`,
  `CREATE TABLE IF NOT EXISTS fl_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fl_rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS fl_chain_events (event_key TEXT PRIMARY KEY, block_number TEXT NOT NULL, block_hash TEXT NOT NULL, tx_hash TEXT NOT NULL, kind TEXT NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS fl_attempts_competition ON fl_attempts(competition_id)`,
  `CREATE INDEX IF NOT EXISTS fl_jobs_due ON fl_jobs(status,next_at,lease_until)`
];
export const privateTables = ['fl_question_packs', 'fl_drafts', 'fl_attempts', 'fl_answers', 'fl_nonces', 'fl_sessions', 'fl_jobs', 'fl_state', 'fl_rate_limits'];
