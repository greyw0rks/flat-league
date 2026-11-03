'use client';

import { useState } from 'react';
import { useAccount, usePublicClient, useSwitchChain, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { chainId, leagueChain, wifAddress } from '@/lib/config';
import { mockWifAbi } from '../../packages/contracts/mockWifAbi';

export function TestToken() {
  const { address, chainId: walletChain } = useAccount();
  const client = usePublicClient({ chainId: leagueChain.id });
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (chainId !== 46630 || !address || !wifAddress) return null;

  async function mint() {
    if (!address || !wifAddress || !client) return;
    setBusy(true);
    setMessage('');
    try {
      if (walletChain !== leagueChain.id) await switchChainAsync({ chainId: leagueChain.id });
      const hash = await writeContractAsync({ address: wifAddress, abi: mockWifAbi, functionName: 'mint', args: [address, parseUnits('1000', 18)], chainId: leagueChain.id });
      const receipt = await client.waitForTransactionReceipt({ hash });
      if (receipt.status !== 'success') throw new Error('Test token request reverted.');
      setMessage('1,000 MockWIF confirmed in your wallet. You can fund your challenge now.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message.split('\n')[0] : 'Test tokens could not be requested.');
    } finally { setBusy(false); }
  }

  return <div className="private-note" style={{ display: 'block', marginBottom: 24 }}>
    <p>This release uses MockWIF test rewards. Creators need test ETH for wallet transactions and MockWIF to fund a pool. Players join free.</p>
    <button className="button secondary" disabled={busy} onClick={() => void mint()}>{busy ? 'Confirming test tokens…' : 'Get 1,000 MockWIF test tokens'}</button>
    {message && <p role="status" style={{ marginTop: 12 }}>{message}</p>}
  </div>;
}
