# Flat League handoff — November 5, 2026

## Current checkpoint — workflow demo

The editable **Flat League** project is prepared in Sequence Studio at **http://127.0.0.1:4310**, verified from Windows. Eight scenes, 103.5 seconds, 1920 × 1080, 30 fps, with ElevenLabs **Jack John – Conversational and Upbeat** (voice ID `7EzWGsX10sAS4c9m9cPf`). The account's alternate name has the same shared-library voice ID. The user renders, exports and uploads; the agent has started no final render/export job. A render started through the editor at 01:50 UTC is preserved. Its stored snapshot uses earlier clip IDs, so reload the editor before rendering the polished version. All eight updated previews pass with zero browser errors and zero agent render requests. See [demo preparation and export instructions](../demo-video/README.md).

The actual recorded local round is `10ee33d6-8d49-4f33-8d30-60c821b0e0dd`, onchain ID 17: creator funding, a fresh player with zero tokens/gas, sponsored registration, ten accepted answers with reload recovery, score 100 in 28.842 seconds, signed settlement and a confirmed 10 MockWIF payout. The five-minute event and two-minute quiz use real time. The round is excluded from public lists/rankings/profile totals; all receipts and prior preparation fixtures are retained. This is Anvil 31337/MockWIF proof, not real mainnet $WIF use.

SQLite preparation failures led to Node's native SQLite connection, a shared queue for same-file clients and schema-version checks that skip unchanged startup migrations. Bump `sqliteSchemaVersion` when editing the schema. Sixteen backend tests pass, including independent process writes, rollback and startup reads while a separate process holds a write transaction; the optional PostgreSQL suite is skipped. The final production build passes with existing optional connector warnings. Capture uses the real worker with `--once`; continuous worker operation is not established by the demo.

The portable project/media kit is generated locally as `demo-video/flat-league-sequence-kit.zip`. Runtime wallet recovery files, raw recordings, generated media and the ZIP are ignored by Git. The source clips retain chronological actions, cut inactive waiting and cover the Next development indicator with a small LOCAL TEST label; the media manifest records these edits.

The user requested closing unused ports. The recording's app/Anvil servers, old HyperFrames preview and all four unused Chainroom containers are stopped, with persisted data preserved. Only Sequence's app ports 4310/4311 remain, alongside system DNS and Codex/container infrastructure. Existing Sequence projects remain preserved. A public demo video URL, actual mainnet $WIF evidence and confirmed Flat League submission remain outstanding user/release steps.

## UI checkpoint — earlier November 5

The Arcadia GoodBuilders game UI direction is implemented locally: warm light surfaces, lavender feature areas, illustrated game worlds, Manrope headings, clearer play buttons, and responsive landing/lobby/detail/ranking/result/form/quiz layouts. Local WebP artwork comes from the builder's reference project; Arcadia branding is excluded. The legacy WebGL scene is no longer mounted. See [the redesign](ARCADE-REDESIGN.md) and [art provenance](../public/world/README.md).

Ten known local seed/browser-proof challenges are privately marked as fixtures. Public lists, league rankings and profile reward totals exclude them; historical rows/contracts/receipts and direct result pages remain accessible. Local seed and lifecycle-check scripts mark new verification rounds automatically. Genuine user rounds remain visible. The hosted competition API returned no rounds during this review.

Current validation: production build, standalone typecheck and 14 backend tests pass (the optional PostgreSQL integration suite is skipped without its isolated database URL). Responsive UI review passes at desktop/tablet/390/360px with keyboard filters/search, wallet focus restoration, reduced motion, retained actual results and an explicitly labelled browser-only three-player podium fixture. Zero browser runtime errors. Existing optional MetaMask native-storage and WalletConnect logging dependencies still emit nonfatal build warnings. No lifecycle/contract tests were rerun and no new funding/play/settlement/payout transaction was sent for this visual update.

The environment loader now supports both Node ESM's CommonJS default export and Next's bundled named export. The production build and standalone CLI work with it.

[Submission answers](SUBMISSION.md) cover the complete form, with text limits checked. The optional square logo is in `public/brand/`. The README is now a short product explanation, with [setup](SETUP.md) and implementation/hosting details linked separately.

The public repository is https://github.com/greyw0rks/flat-league and the hosted testnet app is https://flat-league.vercel.app. The user authorized pushing this UI/submission update to `main` on November 5. Vercel is connected to the repository; confirm its deployment status before treating the live app as the new release. No separate deployment command is part of this push. Local preview: http://127.0.0.1:3020/discover. Keep local Anvil/SQLite configuration separate from hosted Neon/testnet configuration.

Remaining submission artifacts: a genuine app-workflow video URL and actual mainnet $WIF transaction evidence. The hosted MVP uses Robinhood Chain testnet (46630), CompetitionManager `0x0e9cb1eb0fdf7d13e2eaec067ec5512acbb1b3bd`, and MockWIF `0xf7c5b108fe25ad17bba9ba4225c40ef167664fc8`. Do not present testnet/Anvil hashes as mainnet $WIF use. No Flat League submission is confirmed. The user will render/export the demo; use Sequence Studio and ElevenLabs Jack John – Conversational and Upbeat when preparing it. Publish the UI, record the actual workflow, test real $WIF integration under an agreed budget, and gather independent playtests.

## Previous checkpoint — November 3

The sections below retain the earlier build history. The current checkpoint above supersedes their UI, environment-loader and pending-hosting descriptions.

## Hosted release checkpoint

The repository is now public at https://github.com/greyw0rks/flat-league and connected to Vercel. The production alias is https://flat-league.vercel.app. An isolated Neon Free database is migrated; the Robinhood testnet MockWIF and CompetitionManager authorities are verified in `evidence/testnet-deployment.json`.

The creator studio includes a wallet-signed request for 1,000 MockWIF test tokens. API activity advances retained jobs with Next.js `after()`; the authenticated GitHub Actions worker provides a five-minute scheduled fallback. The first hosted worker run succeeded. `evidence/hosted-ui.json` records public page/API checks at 1440/390/360px, with no browser runtime errors. Tests and the production build pass. Mainnet WIF and hardware WebGL verification remain open; no external participant or real WIF payout is claimed.

The worker environment import now uses named `loadEnvConfig`, which works in both the CLI and bundled Vercel worker route. Local preview configuration remains separate from `.data/hosted.env`. See [HOSTING.md](HOSTING.md) for the hosted architecture and schedule limits.

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

The initial local checkpoint preceded GitHub publication. Atlas's missing dependencies were restored and its dotenv startup banner silenced. A direct MCP client verified handshake, session start/end, memory storage on Walrus and summary/task read-back. Atlas is running at localhost:3005; its MCP session API also reconnects successfully. This file remains the local handoff copy.
