import { createPublicClient, http } from 'viem';
import { leagueChain, managerAddress } from '../lib/config';
import { ensure } from './errors';
export function chainClient() {
  return createPublicClient({ chain: leagueChain, transport: http(process.env.RPC_URL || leagueChain.rpcUrls.default.http[0], { timeout: 15_000 }) });
}
export function requireManager() { ensure(managerAddress, 'NOT_DEPLOYED', 'This network has not been deployed yet.', 503); return managerAddress; }
export const confirmations = () => Math.max(1, Number(process.env.CONFIRMATIONS || 2));
