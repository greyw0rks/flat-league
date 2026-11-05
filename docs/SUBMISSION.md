# Flat League submission

Prepared November 5, 2026. Copy the text beneath each field label. All text fields are within the form's character limits.

The hosted MVP uses Robinhood Chain testnet (46630) and MockWIF. No mainnet $WIF transaction proof or hosted Flat League demo video is available yet. This source release includes the latest game UI and demo cleanup; confirm the hosted deployment before recording the demo.

## Your project

**Project name — 60 characters maximum**

Flat League

**Project logo — optional**

Upload [flat-league.png](../public/brand/flat-league.png). [Editable SVG](../public/brand/flat-league.svg).

**One liner — 80 characters maximum**

Free-to-enter knowledge competitions with creator-funded $WIF rewards.

**Category**

Games first (main category), then Social and creators.

**What it does — 1,500 characters maximum**

Flat League turns community trivia into a competitive game with creator-funded rewards. A creator writes ten questions, sets a schedule and deposits a prize pool into an escrow contract. Players connect a wallet and take one 120-second run for free. Correct answers determine the score; speed breaks ties. Scores stay private until the round closes.

After closing, the scoring service signs the results and the contract allocates the pool to the top three finishers using 60/25/15 weights, adjusted when fewer players finish. The platform sponsors registration and ordinary reward delivery. Players can inspect results, see their rankings and return for another round; creators can host new challenges for their communities.

The working MVP is deployed on Robinhood Chain testnet with MockWIF test rewards. Mainnet $WIF integration is the next release milestone. Scoring is server-authorized, and one attempt per wallet does not establish one unique human.

**Who it's for — 500 characters maximum**

Community hosts, creators and trivia groups who want a repeatable game night with a funded prize pool, and casual players who enjoy short knowledge challenges. Players need no entry tokens; hosts provide the rewards and pay approval/funding gas. The current testnet release is for testing the workflow with MockWIF before a mainnet launch.

## How it connects to $WIF

**How does it use $WIF — 1,000 characters maximum**

$WIF is designed to be the prize asset. Creators approve and deposit it into CompetitionManager, which keeps each round's escrow separate. After the round closes, the scoring service signs a winner allocation and the contract makes rewards claimable by the fixed winning wallets. The platform can deliver those rewards through sponsored claimFor transactions; winners can also claim themselves. Cancellation, no-contest and expiry rules provide refund paths.

Players enter for free. The MVP charges no platform fee and implements no buyback or holding gate. The hosted build currently exercises this flow with MockWIF on Robinhood Chain testnet, not mainnet $WIF. The mainnet token integration and funded lifecycle still need verification.

**Integration type**

- $WIF is paired, staked or locked — locked as creator-funded prize escrow; this is not staking.
- Other — performance-based rewards to winners.

Do not select fee/payment, buyback or holding-unlocks options: those mechanisms are not implemented.

**Contract addresses**

If the field requires mainnet contracts, leave it blank. If testnet contracts are accepted, paste this with its network label:

Robinhood Chain TESTNET (46630): CompetitionManager 0x0e9cb1eb0fdf7d13e2eaec067ec5512acbb1b3bd. Test reward token: MockWIF 0xf7c5b108fe25ad17bba9ba4225c40ef167664fc8. No project contract deployed on mainnet yet.

These addresses are recorded in [deployment evidence](../evidence/testnet-deployment.json). The existing mainnet $WIF token is not a Flat League contract.

**Permission to link, feature or integrate on worldisflat.fun**

Choose the checkbox yourself; this draft does not grant permission on your behalf.

## Your flywheel

**What does someone do — 500 characters maximum**

A host funds and publishes a knowledge challenge, then shares it with their community. Players join for free, complete a two-minute run and compare their final results. Hosts can create follow-up rounds; players can improve their ranking in later challenges.

**What happens to $WIF when they do it — 500 characters maximum**

In the intended mainnet flow, the host's $WIF is locked in that round's escrow and allocated to the best finishers after closing. Sponsored claims deliver rewards to the winning wallets. Eligible cancelled, expired or no-contest rounds return the pool to the host. The current live build uses MockWIF test tokens for this flow.

**Why does that bring them, or others, back — 500 characters maximum**

New rounds give players another chance to improve their score and earn rewards without an entry fee. Hosts can turn one challenge into a recurring community event with new questions and fresh prize pools. Sharing results can invite more players, while repeat hosts create recurring demand to fund $WIF pools. This is the intended loop; repeat usage has not yet been measured.

## Proof of build

**GitHub repo — 300 characters maximum**

https://github.com/greyw0rks/flat-league

**Demo video — 300 characters maximum**

Pending: paste a public or unlisted video URL after export and upload. Keep it under three minutes and show the actual app workflow.

The user will render and export. Use Sequence Studio for the Flat League edit and ElevenLabs Jack John – Conversational and Upbeat for narration. No Flat League video is claimed as completed.

**Live link — 300 characters maximum**

https://flat-league.vercel.app

**Transactions**

Leave blank until there are verified transactions using real $WIF on Robinhood Chain. Current evidence consists of MockWIF deployments on Robinhood Chain testnet and a local Anvil lifecycle; neither establishes mainnet $WIF usage. Do not paste those hashes into this field as real $WIF proof.

**How it's made — 1,500 characters maximum**

Next.js, React and TypeScript power the app. Wagmi and viem handle wallet connections and contract calls; SIWE authenticates players. The hosted service uses Neon PostgreSQL, with private question, session and job tables. Local development uses Node's native SQLite and Anvil. Solidity CompetitionManager uses OpenZeppelin and EIP-712 signatures; Foundry tests the escrow and settlement rules. A persistent worker sponsors registration and reward delivery, while Vercel and scheduled GitHub Actions run the hosted workflow.

The hardest part was connecting a timed, server-scored quiz to recoverable onchain settlement. Answers must remain private during play, retries must not change accepted answers or produce duplicate effects, and a signed allocation must account for the whole escrow pool. The build includes server deadlines, immutable answers, frozen result artifacts, isolated escrow accounting, persistent transaction recovery and fixed-recipient claims. Scoring still trusts the service, and reorg/drop recovery needs further hardening before a funded mainnet launch.

**What's next — 500 characters maximum**

Publish the refreshed game UI, record a real workflow demo, and run independent community playtests. Verify mainnet $WIF transfer and approval behavior, deploy the manager with production authorities and prove a funded round through payout. Then improve worker reconciliation and operational visibility, measure repeat hosts and players, and refine the game from their feedback.
