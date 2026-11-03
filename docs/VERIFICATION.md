# Verified facts and remaining gates

Checked November 2, 2026 using official website/documentation and direct JSON-RPC reads. Evidence snapshots are stored in `../evidence/`.

## Robinhood Chain

Source: [official connecting documentation](https://docs.robinhood.com/chain/connecting).

| Property | Mainnet | Testnet |
| --- | --- | --- |
| Chain ID | 4663 | 46630 |
| Native gas | ETH | ETH |
| Public RPC | `https://rpc.mainnet.chain.robinhood.com` | `https://rpc.testnet.chain.robinhood.com` |
| Explorer | `https://robinhoodchain.blockscout.com` | `https://explorer.testnet.chain.robinhood.com` |
| Provider RPC example | `https://robinhood-mainnet.g.alchemy.com/v2/{API_KEY}` | `https://robinhood-testnet.g.alchemy.com/v2/{API_KEY}` |

The documentation describes an Arbitrum Layer-2 on Ethereum, using Ethereum blobs for data availability. Public endpoints are rate limited and explicitly not recommended for production; use a provider endpoint.

Direct `eth_chainId` results: mainnet `0x1237` = 4663; testnet `0xb626` = 46630.

Finality guidance: [transaction finality](https://docs.robinhood.com/chain/transaction-finality). Choose and document the application confirmation threshold during implementation rather than assuming Ethereum L1 confirmation behavior.

## WIF

Source: [World Is Flat website](https://worldisflat.fun), including its token address and explorer link. This is the project's WIF on Robinhood Chain; do not infer identity from other tokens using the WIF symbol.

Address: `0x5173b8eA6923c2d40267890D45C46a3480954773`.

Pinned reads at mainnet block **104502002** (`0x63a92f2`):

| Read | Result | What it establishes |
| --- | --- | --- |
| `eth_getCode` | 3248 bytes | Contract code exists at the address |
| `decimals()` | 18 | Base-unit parsing precision |
| `symbol()` | WIF | Token's returned symbol; website establishes identity |
| `balanceOf(address(0))` | 0 | Standard read selector succeeds for this input |
| `allowance(address(0),address(0))` | 0 | Standard read selector succeeds for this input |

These are read-only calls. No wallet was accessed, approval granted, funds transferred or contract deployed.

Blockscout API requests for verified source/metadata encountered a Cloudflare challenge. Consequently the token source, proxy/admin behavior and transfer restrictions were not verified in this planning pass. Do not interpret the bytecode/reads as a contract audit.

Remaining token gate: obtain verified source or equivalent reliable inspection; establish any proxy/admin, pause, allowlist or transfer-fee behavior; test approval, transfer and exact balance-delta escrow using the actual token. Use a mainnet fork for preparation and limited real transactions for launch evidence.

The mainnet address is not a verified testnet token. Use explicitly labeled MockWIF locally/testnet.

## Hackathon

Sources: [rules](https://worldisflat.fun/build/rules), [official event API](https://worldisflat.fun/build/api/event), and [public rules copy](https://worldisflat.fun/build/assets/js/copy.js).

| Milestone | UTC | Nigeria / WAT |
| --- | --- | --- |
| Building starts | Oct 21, 2026, 17:30 | Oct 21, 18:30 |
| Submission closes | Nov 12, 2026, 17:30 | Nov 12, 18:30 |
| Round one closes | Nov 14, 2026, 17:30 | Nov 14, 18:30 |
| Final closes | Nov 16, 2026, 17:30 | Nov 16, 18:30 |

The event API returned phase `building` and the announcement extending submissions to November 12. Recheck announcements before release because organizers can extend dates.

Relevant requirements: real WIF use on Robinhood Chain; recurring-use flywheel; working project through the final; judge-accessible repository, demo and real transactions; team size one to four; one team per person; adults only. Prize is 10,000 USDG to one winner.

Repository correction: the FAQ explicitly permits a private repo if the organizer GitHub account `wifonrh` is invited. This plan chooses a public repository for clear reviewability; public visibility is not an absolute event rule.

Submission edits lock at closing, with the published project-logo exception through final close. Preserve the submitted version during judging and clarify with organizers before corrective code changes.

Stock Token restrictions apply to projects in that category. Flat League does not use Stock Tokens. General eligibility/payout requirements still apply; the user's timezone alone does not establish citizenship, residence or payout eligibility.

## Assumptions still to resolve during implementation

- Actual builder/team arrangement; the schedule assumes one builder.
- Creator WIF funding budget and deployment/relayer ETH budget.
- Production Supabase, hosting and RPC configuration.
- Secure signer/admin/registrar wallets and rotation/recovery procedures.
- Confirmed token transfer behavior and source inspection.
- Provider rate limits, finality threshold and worker hosting reliability.
- Question quality, answer sharing, latency fairness and repeat sponsor demand.

No simulated transactions, users or screenshots count as launch evidence.
