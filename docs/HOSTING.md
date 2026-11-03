# Hosted testnet MVP

Flat League uses Next.js on Vercel, an isolated Neon Free PostgreSQL database, and its verified Robinhood Chain testnet contracts. Public rewards are **MockWIF test tokens**, with no monetary value. Mainnet WIF integration remains a separate milestone.

The landing page leads to discovery and the creator studio. Creators can request 1,000 MockWIF from the test token contract using their browser wallet; they need test ETH for minting, approval, and funding. Players receive sponsored registration and reward delivery.

Run `pnpm db:migrate` against the direct Neon URL before activating the app. All application tables use RLS; quiz, auth, and worker tables live in the private schema, with PUBLIC grants revoked. Neon server credentials are private environment variables, never browser configuration.

`FLAT_HOSTED_WORKER=true` advances retained jobs after competition API requests with Next.js `after()`. A GitHub Actions workflow calls the authenticated `/api/worker` endpoint every five minutes for quiet periods. Configure its `WORKER_TOKEN` secret to the Vercel `CRON_SECRET`. GitHub schedules can be delayed; the API also advances work during active use.

Verification records are in `evidence/testnet-deployment.json` and `evidence/hosted-storage.json`. Preserve `.env.local`, `.data/`, and the local Anvil preview separately from hosted configuration. Credentials and signed deployment bytes stay ignored.
