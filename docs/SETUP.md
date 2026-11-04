# Local setup and checks

Use Node.js 22.22.2 or newer, pnpm, and Foundry (`forge` and `anvil` on PATH).

```sh
pnpm install --frozen-lockfile
pnpm contracts:build
```

Start the persistent local chain in one terminal:

```sh
mkdir -p .data
pnpm local:chain
```

Deploy the local contracts and initialize the database:

```sh
pnpm local:deploy
pnpm db:migrate
```

The deployment writes `.env.local` with public **local-only** Anvil keys. Its three sample rounds are marked as fixtures and excluded from public discovery and totals. Start the app and worker in separate terminals:

```sh
pnpm dev
pnpm worker
```

Open [127.0.0.1:3020](http://127.0.0.1:3020). Add local chain ID `31337`, RPC `http://127.0.0.1:8547`, and ETH gas to a browser wallet. Anvil's first account holds sample MockWIF for creator funding; players need no tokens. Never use these public accounts on a real network. The browser verification script supplies its own isolated test wallets.

The chain periodically saves `.data/anvil-state.json` and synchronizes its clock on startup; retain it together with the database and `.env.local` across restarts. Stop the app and worker before an intentional chain reset. Then `pnpm local:deploy --fresh` archives the old local database/configuration before creating another playground. It refuses to replace an active deployment. Existing sample rounds close six hours after creation; create a new round for later play.

After deployment and `pnpm build`, Linux users can run `pnpm local:up` to keep the local chain, production preview and worker running independently of the terminal. It saves service PIDs and logs in `.data/runtime/` and skips an already running worker. Stop these service processes before resetting the playground.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm contracts:test
pnpm build
pnpm check:ui
pnpm check:ui-polish
```

`check:ui` requires the app, worker and local chain running. It authors/funds a round through the browser, signs in another wallet, checks quiz reload recovery, waits for actual closing, and verifies signed settlement and the recipient's MockWIF balance increase. Its verification round is marked as a fixture and excluded from public lists; direct receipt hashes and screenshots remain under `evidence/`. The check takes approximately four minutes because the published competition window is respected.

`check:ui-polish` is a read-only layout check: desktop, tablet, 390px/360px mobile, keyboard filters, wallet focus restoration, search, podium ordering and reduced motion. It can use retained local results without restoring demo listings. Three-player podium screenshots are browser-only fixtures identified in `evidence/ui-polish.json`. The new game artwork uses local images and has no WebGL dependency.

See [implementation and operational limits](IMPLEMENTATION.md) for the current security boundaries, deployment requirements and next work.


## Demo cleanup

To hide historical seeded and browser-proof rounds in a retained local playground:

```sh
pnpm exec tsx scripts/hide-local-demo-rounds.ts
```

This matches known fixtures from the public Anvil creator, refuses networks other than `31337`, and preserves rows, contracts and receipts. Genuine user-created rounds remain visible.

Avoid running a build and dev server against the same output directory at once. An isolated build can use `FLAT_BUILD_DIR=.next-release pnpm build`.

See [hosting](HOSTING.md) for Vercel, Neon PostgreSQL and Robinhood Chain testnet configuration. Keep server credentials separate from local Anvil configuration.
