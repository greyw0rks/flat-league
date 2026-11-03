# Flat League handoff — November 3, 2026

The local competition loop is implemented and verified. Continue with the production gates in [IMPLEMENTATION.md](IMPLEMENTATION.md), rather than rebuilding the scaffold.

## Current verification

- 13 backend tests pass, including independent-process SQLite writes, concurrency, authenticated nonce replay, locked-answer retries and exact quiz deadlines.
- Seven PostgreSQL integration checks pass on PostgreSQL 17.11 with two independent pools and a non-superuser, non-RLS-bypass application owner. They cover API grants/private-schema isolation, migration reruns, RLS, concurrency, nonce replay and rollback. [Validation record](../evidence/postgres-validation.json). Run `POSTGRES_TEST_URL=postgresql://<validation-admin>@127.0.0.1:<port>/postgres pnpm test:postgres` on an isolated cluster; ordinary backend tests skip this suite without that variable.
- 11 Foundry tests pass, including 256 fuzz runs for exact allocations.
- TypeScript and the Next.js production build pass. The wallet connector dependency tree emits optional native MetaMask storage/logging warnings; injected-wallet browser behavior was verified.
- `pnpm check:ui` passed against the production build: creator authoring/approval/funding, fresh player with zero tokens/gas, sponsored registration, all ten answers, reload recovery, hidden live scores, signed settlement, confirmed exact 10 MockWIF reward increase, committed questions, mobile overflow and public routes. Browser runtime errors were absent in the creator/player contexts.
- Another completed round settled and paid after a worker restart. No real WIF transaction or external participant is claimed.

Latest verified local round: `a6e7b369-7f2d-46f7-b61b-970c61fe7321`, onchain ID `10`. The fresh zero-gas player completed keyboard radio selection, ten answers and reload recovery; each accepted answer moved focus to the new question. Settlement delivered exactly 10 MockWIF. [Receipt report](../evidence/local-lifecycle.json), [frozen result artifact](../evidence/local-result-artifact.json) and [results screenshot](../evidence/ui/results-desktop.png).

## UI checkpoint

The user's latest direction is to work on UI and animations toward the MVP. The UI pass adds a brighter faceted arena with orbital markers, one shared poster fallback, finite headline motion, scoped desktop GSAP scroll, a GPU-motion pause control, stable card artwork and filter layout transitions, clearer entry/return actions, native quiz keyboard selection, question focus after acknowledgement, confirmation marks, readable mobile podium cards, sharing and the next available round. The wallet drawer now restores focus after closing. Challenge cards remain visible before hydration.

The focused review is `pnpm check:ui-polish`. It covers 1440px desktop, 768px tablet, 390px and 360px mobile, search/empty states, keyboard filters, drawer focus and podium order. Three-player podium screenshots are browser-only fixtures, identified in the report; no simulated participants are persisted. [Review report](../evidence/ui-polish.json), [desktop](../evidence/ui/landing-polished-desktop.png) and [mobile](../evidence/ui/landing-polished-mobile.png).

Both the headless shell and full Chromium fail a direct WebGL2 context probe here. GPU motion/frame-rate checks remain open. On WebGL initialization failure the scene reports static mode and hides inactive pause controls; reduced motion also uses the poster and skips the canvas. The probe is `pnpm exec tsx scripts/check-webgl.ts`. The focused review runs frame/pause/offscreen/context-loss checks automatically when a GPU context is available.

## Running preview

App: `http://localhost:3020`. Local Anvil RPC: `http://127.0.0.1:8547`, chain 31337. Detached chain, web and worker services were started through `pnpm local:up`; their owned PIDs/logs are in `.data/runtime/`. Use the health endpoint and PID/log files to inspect them before starting duplicates.

The UI build was activated on November 3 using the normal `.next` directory. The previous build is archived under `.data/builds/ui-before-1793691341184`. Production build, standalone typecheck and the final `check:ui-polish` passed on port 3020; the report was refreshed at 07:47 UTC. Health returned configured/ready with a healthy worker. Only the web process was restarted (PID 41050); the original worker and chain remain running. Mobile reward labels now sit above their amounts. WebGL remains unavailable here, so the report explicitly leaves GPU frame/pause/offscreen checks open while verifying static fallback and hidden inactive controls.

Preserve `.env.local`, `.data/flat-league.db` and its WAL files, and `.data/anvil-state.json` together. `pnpm local:chain` restores the saved chain and synchronizes its clock before timed operations. `pnpm local:deploy --fresh` archives an old reset playground and refuses to replace an active contract deployment. Stop the app/worker before an intentional reset. Sample rounds close six hours after creation; the creator form can fund new rounds.

## Fixes made during resumption

- Serialized SQLite client operations, enabled WAL and lock waits, and added PostgreSQL row locks around capacity and answer/expiry mutations.
- Fixed CommonJS environment loading for the worker/database CLI.
- Refreshed cached competition data before navigating into a newly started quiz and cached the returned attempt.
- Removed projected rewards from refunded/cancelled rounds and corrected placement points to 10/6/4.
- Retained uncertain transaction bytes for recovery, cleared consumed reverted transactions before retries, and added graceful worker shutdown.
- Included the frozen rules in public result artifacts.
- Added setup, persistent preview startup, focused tests, browser verification and local receipt evidence.
- Made migrations atomic and revoked explicit Supabase `anon`/`authenticated` table/private-schema grants in addition to PUBLIC access. Verified against a real isolated PostgreSQL server; hosted Supabase configuration still needs inspection.

## Next work

1. Continue worker recovery/receipt work below. PostgreSQL behavior is locally validated; apply the migration and inspect hosted Supabase role memberships/default grants/exposed schemas when hosting is configured.
2. Harden worker lease renewal, dropped/replaced transactions and reorg/receipt reconciliation; add operational views.
3. Inspect real WIF transfer restrictions, exercise a Robinhood testnet lifecycle, then deploy/verify mainnet contracts with production wallets and an agreed funding budget.
4. Review actual device/keyboard/WebGL performance and creator account-change/reverted-funding recovery. Headless normal-motion screenshots can use the static fallback and do not prove hardware WebGL performance.
5. Publish/deploy, recruit external participants, gather real WIF evidence and prepare the demo/submission.

Git still has no initial commit or remote; the project files are untracked. Atlas's missing dependencies were restored and its dotenv startup banner silenced. A direct MCP client verified handshake, session start/end, memory storage on Walrus and summary/task read-back. Reconnect/restart Codex's Atlas server to load its tools in the editor. Atlas now contains the worker TODO and this session's handoff; this file remains the local copy.
