import { defineChain, isAddress, type Address } from 'viem';

export const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID || 46630);
const networks: Record<number, { name: string; rpc: string; explorer?: string }> = {
  4663: { name: 'Robinhood Chain', rpc: 'https://rpc.mainnet.chain.robinhood.com', explorer: 'https://robinhoodchain.blockscout.com' },
  46630: { name: 'Robinhood Chain Testnet', rpc: 'https://rpc.testnet.chain.robinhood.com', explorer: 'https://explorer.testnet.chain.robinhood.com' },
  31337: { name: 'Flat League Local', rpc: 'http://127.0.0.1:8547' }
};
const network = networks[chainId];
if (!network) throw new Error('Unsupported Flat League network.');
export const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || network.rpc;
export const leagueChain = defineChain({
  id: chainId, name: network.name, nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  ...(network.explorer ? { blockExplorers: { default: { name: 'Blockscout', url: network.explorer } } } : {})
});
const parseAddress = (s: string | undefined): Address | null => s && isAddress(s) ? s as Address : null;
export const managerAddress = parseAddress(process.env.NEXT_PUBLIC_MANAGER_ADDRESS);
export const wifAddress = parseAddress(process.env.NEXT_PUBLIC_WIF_ADDRESS);
export const configured = Boolean(managerAddress && wifAddress);
export const isLocal = chainId === 31337;
export const currencyLabel = isLocal || chainId === 46630 ? 'MockWIF' : 'WIF';
export const explorerTx = (hash: string) => network.explorer ? `${network.explorer}/tx/${hash}` : null;
export const shortWallet = (s: string) => s.slice(0, 6) + '…' + s.slice(-4);
