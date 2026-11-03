# Flat League

**Live testnet MVP:** https://flat-league.vercel.app · **Source:** https://github.com/greyw0rks/flat-league

The hosted release uses isolated Neon PostgreSQL and verified Robinhood Chain testnet contracts. Rewards are MockWIF test tokens. [Hosting details](docs/HOSTING.md) cover the browser test-token button, sponsored jobs, and scheduled worker.

Compete for something real.

Creator-funded, free-to-enter knowledge competitions. WIF funds the prize pool; performance determines the winners; Robinhood Chain records escrow and reward settlement.

The local MVP includes the Next.js arena, creator authoring and escrow funding, wallet login, sponsored registration, a server-timed quiz, signed result settlement, fixed-recipient payouts, results and profiles. Robinhood testnet/mainnet deployment remains a release gate. Local evidence uses MockWIF and published Anvil test accounts.

## Run locally

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

Then deploy the local contracts and create three sample rounds:

```sh
pnpm local:deploy
pnpm db:migrate
```

The deployment writes `.env.local` with public **local-only** Anvil keys. Start the app and worker in separate terminals:

```sh
pnpm dev
pnpm worker
```

Open [localhost:3020](http://localhost:3020). Add local chain ID `31337`, RPC `http://127.0.0.1:8547`, and ETH gas to a browser wallet. Anvil's first account holds sample MockWIF for creator funding; players need no tokens. Never use these public accounts on a real network. The browser verification script supplies its own isolated test wallets.

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

`check:ui` requires the app, worker and local chain running. It authors/funds a round through the browser, signs in another wallet, checks quiz reload recovery, waits for actual closing, and verifies signed settlement and the recipient's MockWIF balance increase. It saves local receipt hashes and screenshots under `evidence/`. The check takes approximately four minutes because the published competition window is respected.

`check:ui-polish` reviews desktop, tablet, 390px/360px mobile, keyboard filters, wallet focus restoration, podium ordering, reduced motion and the WebGL fallback. Three-player podium screenshots use an isolated browser fixture; the report identifies them. On a WebGL-capable machine the same check also verifies moving frames, pause/resume, offscreen suspension and context-loss recovery. This environment cannot create a WebGL2 context, so GPU motion/performance still needs a device check. Screenshots and the report are under `evidence/ui/` and `evidence/ui-polish.json`.

See [implementation and operational limits](docs/IMPLEMENTATION.md) for the current security boundaries, deployment requirements and next work.

## Read the specification

| Document | What it resolves |
| --- | --- |
| [Build plan](docs/BUILD-PLAN.md) | Scope, daily deliverables, dependencies, launch gates, MVP checklist and submission evidence |
| [Architecture](docs/ARCHITECTURE.md) | Contract lifecycle, authentication, sponsored registration, scoring, settlement, database and operations |
| [Design and UI/UX](docs/DESIGN.md) | Screen layouts, colors, components, Three.js scene, Framer Motion, GSAP, mobile and interaction states |
| [Visual reference](design/visual-reference.png) ([editable SVG](design/visual-reference.svg)) | Static desktop mockup of the palette, arena illustration and competition cards; sample data |
| [Verified facts](docs/VERIFICATION.md) | Official network and event information, direct token reads, sources and unresolved checks |

## Decisions

- One challenge type: ten-question, 120-second knowledge runs.
- Creators fund rewards in WIF; players pay no entry fee.
- Platform sponsors participant registration and ordinary reward delivery. Creator approval/funding still require gas.
- One principal contract, `CompetitionManager`, with isolated escrow accounting for each competition.
- Server scores attempts and signs results; that authority is disclosed.
- Finalization allocates rewards. Permissionless `claimFor` sends each reward to its fixed winner, allowing platform sponsorship and independent recovery.
- Next.js, TypeScript, Tailwind, shadcn/ui primitives, wagmi, viem, TanStack Query and Supabase.
- Three.js through React Three Fiber and Drei, Framer Motion for interface choreography, GSAP for landing-page scroll.
- No platform fee in the MVP. Sponsor retention must be demonstrated before introducing monetization.
- The database uses SQLite/libSQL locally and PostgreSQL for production, including Supabase. Local PostgreSQL permission/concurrency checks pass; hosted role memberships, default grants and exposed schemas still need inspection.

## Verified configuration

| Field | Value |
| --- | --- |
| Mainnet | Robinhood Chain, ID `4663` |
| Testnet | Robinhood Chain Testnet, ID `46630` |
| Gas currency | ETH |
| WIF | `0x5173b8eA6923c2d40267890D45C46a3480954773` |
| WIF decimals | `18`, read directly from mainnet |
| Submission closes | November 12, 2026, 17:30 UTC / 18:30 WAT |
| Internal submission target | November 12, 13:30 UTC / 14:30 WAT |
| Final closes | November 16, 2026, 17:30 UTC / 18:30 WAT |

Mainnet transfer behavior is still a deployment gate. A token symbol and decimals are insufficient evidence for safe integration.
