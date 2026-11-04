# Implementation status and operations

The November 3 hosted MVP runs on Vercel, Neon PostgreSQL and Robinhood Chain testnet (46630), using MockWIF. Anvil chain 31337 retains the local lifecycle proof. Neither establishes mainnet $WIF use. The November 5 source update includes the game UI and demo cleanup; see [the redesign handoff](ARCADE-REDESIGN.md).

## Implemented

- `CompetitionManager.sol`: immutable token, atomic exact-balance funding, isolated pool liabilities, authority snapshots, sponsored registration, EIP-712 allocation, fixed-recipient claims, cancellation and no-contest/expiry refunds.
- Wallet authentication: five-minute one-use SIWE nonce bound to the configured app/network, hashed twelve-hour session cookie, same-origin mutation checks and rate limits.
- Creator studio: ten custom questions, schedule, reward pool, private draft, salted pack commitment, exact token approval/funding, persisted transaction state and worker recovery of funded drafts.
- Quiz: one attempt per wallet/round, randomized question/option order, only the current question exposed, server deadline, immutable idempotent answers, reload recovery and partial-attempt expiry scoring. No accepted answers means abandonment.
- Worker: persistent effect keys, registration, attempt expiry, frozen scoring artifact, server-only EIP-712 signing, sponsored payout, transaction bytes stored before broadcast and retries. Confirmed reverts clear their consumed transaction so recovery can sign a new nonce. Graceful shutdown finishes the active tick and releases its lease.
- Interface: light arcade lobby and locally stored trophy/question/chest/podium artwork across landing, discovery, detail and rankings. Keyboard answer selection, question focus, responsive podiums, sharing and a next available challenge remain available. Wallet drawers restore focus to their opening control. Placement points are 10/6/4; other valid completions receive one. The legacy orbital WebGL scene remains in source but is no longer mounted.
- Known demo rounds are excluded from public discovery, ranking activity and profile reward totals through private fixture markers; direct historical evidence is preserved. New local deployment/check fixtures are marked automatically.
- SQLite operations serialize per client; joins lock competition capacity and answer/expiry operations lock attempts under PostgreSQL. Unique constraints enforce one attempt and one answer per question.

## Verification

Backend tests cover concurrent starts/joins, locked-answer retries, exact timer cutoff, hidden live scores, scoring, abandoned attempts, reward rounding, commitment hashing, same-origin mutations and nonce replay/domain/expiry behavior. Foundry tests cover settlement, authority, refunds, transfer rejection/recovery, cross-pool accounting and fuzzed exact allocations.

Seven PostgreSQL integration checks also pass against PostgreSQL 17.11 using a database owner with neither superuser nor RLS-bypass privileges and two independent connection pools. They verify repeated migration, removal of Supabase-style API grants, private-schema isolation, RLS enforcement, capacity, one attempt, immutable/idempotent answers, exact expiry, nonce replay, concurrent upserts and rollback. This validates local PostgreSQL behavior; inspect the hosted project's role memberships and exposed schemas before release.

Run `POSTGRES_TEST_URL=postgresql://<validation-admin>@127.0.0.1:<port>/postgres pnpm test:postgres` against an isolated validation cluster. The suite creates and removes a temporary database and application role, and requires database/role creation privileges. It creates `anon`/`authenticated` roles only when absent and removes roles it created. Ordinary `pnpm test` skips this suite when `POSTGRES_TEST_URL` is unset.

The reproducible browser check is `scripts/check-ui.ts`. It creates a fresh player with no tokens or gas and confirms its exact reward balance increase. Its local lifecycle report and screenshots are stored in `evidence/local-lifecycle.json` and `evidence/ui/` after a successful run. This mutating lifecycle check was not rerun for the visual redesign; it creates funded local verification activity.

`pnpm check:ui-polish` checks layout, keyboard filters, focus restoration, search/empty states, podium ordering and reduced motion on 1440px, 768px, 390px and 360px views. Three-place podium images are browser-only fixtures and are marked in `evidence/ui-polish.json`; they do not represent extra participants or rewards. The current game UI uses static image artwork with no mounted WebGL canvas.

## Deployment requirements

Set public chain/token/manager/RPC settings in `.env.example` and server-only `DATABASE_URL`, `RPC_URL`, `APP_URL`, signer/relayer keys, deployment block and confirmation threshold. Run `pnpm db:migrate` against PostgreSQL before starting the app. Never put secrets in a `NEXT_PUBLIC_` variable.

The migration creates private quiz/auth/job tables in the `private` schema, enables RLS on all tables, and revokes table access from PUBLIC and existing `anon`/`authenticated` roles. It also revokes their private-schema access and schema-specific default table grants. Schema creation and permission changes commit together. Run migration and server processes as the same dedicated table-owning database role; ownership allows server queries through RLS without granting browser API roles access. PostgreSQL migrations are explicit, never run by HTTP requests. Keep `private` out of Supabase's exposed schemas and verify hosted role memberships/default grants before release.

Run one worker process with a dedicated funded relayer account. `/api/health` reports configuration and heartbeat age. It is a shallow health check, not an RPC/escrow audit. Inspect failed jobs and relayer balance directly until an operational dashboard is added. Reward recipients can claim independently if sponsored delivery fails.

Use provider RPC endpoints for production. Browser contract writes need the selected chain and creator ETH gas. WalletConnect is configured only when a project ID is supplied; the current browser proof exercises the injected connector.

## Outstanding release gates

1. Keep the verified hosted PostgreSQL permissions intact as migrations and service roles evolve; deployment evidence is in `evidence/hosted-storage.json`.
2. Add operational views, stronger worker lease renewal and relayer nonce replacement/manual recovery. A dropped/replaced transaction can otherwise keep retrying its stored bytes.
3. Complete receipt/event reconciliation across finalization, payouts and reorgs. Current polling rechecks competition/participant state and backfills creation logs with a five-block overlap; confirmed payout hashes are not fully rolled back/reconciled during reorgs. This is not a production-complete indexer.
4. Exercise worker process crashes/restarts during uncertain broadcasts and multiple-round concurrency. The worker processes one job per tick and polls at most 100 recent rounds/drafts.
5. Inspect real WIF source/transfer restrictions, validate transfer/approval/exact escrow, then deploy/verify mainnet contracts with production keys and an agreed funding budget. Testnet contracts already exist; they use MockWIF.
6. Publish the refreshed game UI and perform physical-device and independent participant testing.
7. Add real $WIF transaction evidence and a workflow demo to the already public repository/hosted app, then preserve the submitted release through final judging.

The scoring service is trusted to judge quiz results. Salted commitments and public transcripts aid review but do not stop answer sharing, external tools, multiple wallets or question authors playing their own pack. Do not claim human uniqueness, cheat resistance or decentralized judging.

The earlier build/design/architecture documents remain the intended release specification. Their unchecked production gates should not be read as completed by this local build.
