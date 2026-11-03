'use client';
import { useAccount, useSignMessage } from 'wagmi';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createSiweMessage } from 'viem/siwe';
import { getAddress } from 'viem';
import { useEffect } from 'react';
import { api } from '@/lib/api';

export function useLeagueSession() {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const client = useQueryClient();
  const query = useQuery({ queryKey: ['session'], queryFn: () => api<{ wallet: string | null }>('/auth/me') });
  useEffect(() => {
    if (isConnected && address && query.data?.wallet && address.toLowerCase() !== query.data.wallet.toLowerCase())
      void api('/auth/logout', {}).then(() => client.invalidateQueries());
  }, [address, isConnected, query.data?.wallet, client]);
  async function signIn() {
    if (!address) throw new Error('Connect a wallet first.');
    if (query.data?.wallet?.toLowerCase() === address.toLowerCase()) return address;
    const nonce = await api<{ nonce: string; domain: string; uri: string; chainId: number; serverNow: number }>('/auth/nonce');
    const message = createSiweMessage({ address: getAddress(address), chainId: nonce.chainId, domain: nonce.domain, uri: nonce.uri,
      nonce: nonce.nonce, version: '1', statement: 'Sign in to Flat League. This does not grant token approval or send a transaction.',
      issuedAt: new Date(nonce.serverNow), expirationTime: new Date(nonce.serverNow + 300_000) });
    const signature = await signMessageAsync({ message });
    const session = await api<{ wallet: string }>('/auth/verify', { message, signature });
    client.setQueryData(['session'], session); await client.invalidateQueries({ queryKey: ['competitions'] });
    return session.wallet;
  }
  return { wallet: query.data?.wallet, loading: query.isLoading, signIn, signOut: async () => { await api('/auth/logout', {}); await client.invalidateQueries(); } };
}
