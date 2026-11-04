# Flat League

Free-to-enter knowledge competitions with creator-funded rewards.

A host writes ten questions and funds a prize pool. Players connect a wallet, take a two-minute run and compete on accuracy, then speed. After the round closes, the scoring service signs the results and the escrow contract allocates rewards to the best finishers. The platform sponsors registration and ordinary reward delivery.

[Try the testnet app](https://flat-league.vercel.app) · [Source](https://github.com/greyw0rks/flat-league)

The hosted MVP runs on Robinhood Chain testnet with **MockWIF test rewards**. Mainnet $WIF integration remains a release milestone. Scoring trusts the service; wallets are not verified unique people.

The game UI uses a light arcade lobby, illustrated challenge worlds and clear play buttons. Sample rounds are excluded from public lists and reward totals. See [hosting](docs/HOSTING.md) for the deployed testnet configuration.

| Read more | What you'll find |
| --- | --- |
| [Local setup and checks](docs/SETUP.md) | Install, run the app/worker/chain, and verify the workflow |
| [Hosting](docs/HOSTING.md) | Vercel, Neon PostgreSQL and testnet configuration |
| [Implementation and operations](docs/IMPLEMENTATION.md) | Stack, trust boundaries and remaining release work |
| [Game UI update](docs/ARCADE-REDESIGN.md) | Design reference, artwork and demo cleanup |
| [Submission answers](docs/SUBMISSION.md) | Form copy and outstanding proof artifacts |
| [Architecture](docs/ARCHITECTURE.md) | Escrow, authentication, scoring and settlement |
| [Build plan](docs/BUILD-PLAN.md) · [Verified facts](docs/VERIFICATION.md) | Original scope, network sources and event dates |
