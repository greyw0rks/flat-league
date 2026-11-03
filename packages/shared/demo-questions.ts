import type { Question } from './domain';
// Public sample answers for local MockWIF demonstrations ONLY. Never treat this as a secret prize pack.
const samples: [string,string,string,string,string][] = [
  ['What does an ERC-20 token contract primarily standardize?', 'Fungible token balances and transfers', 'Website authentication', 'NFT artwork', 'Network consensus'],
  ['What is the native gas currency on Robinhood Chain?', 'ETH', 'WIF', 'USDG', 'BTC'],
  ['Which operation lets a contract spend an ERC-20 token allowance?', 'transferFrom', 'balanceOf', 'symbol', 'decimals'],
  ['Which property makes an API retry safe to repeat?', 'Idempotency', 'Randomness', 'Higher latency', 'More animations'],
  ['What does escrow mean in a funded competition?', 'Funds are held until rules permit payout or refund', 'Funds earn a guaranteed return', 'The token price is fixed', 'The player pays an entry fee'],
  ['Which signature standard binds structured data to a domain?', 'EIP-712', 'ERC-721', 'HTTP/2', 'UTF-8'],
  ['What prevents the same quiz answer retry from being accepted twice?', 'A unique idempotency key', 'A new wallet popup', 'A random prize', 'A shorter timer'],
  ['Which unit should be used for exact token accounting?', 'Integer base units', 'Rounded USD estimates', 'JavaScript floating-point amounts', 'Screen pixels'],
  ['What should happen if a funded round has no valid attempts?', 'Its pool is refunded through the defined rules', 'The prize goes to a random wallet', 'The pool doubles', 'Every player is charged'],
  ['What determines the first tie break in a Flat League Knowledge Run?', 'Server-measured completion time', 'Wallet balance', 'Token price', 'Number of followers']
];
export const demoQuestions: Question[] = samples.map(([prompt,...options],i)=>({id:`q${i+1}`,prompt,options:options.map((text,j)=>({id:`q${i+1}-${j}`,text})),correctOption:`q${i+1}-0`}));
