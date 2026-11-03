'use client';
import * as Dialog from '@radix-ui/react-dialog';
import { useAccount, useConnect, useDisconnect, useBalance, useReadContract, useSwitchChain } from 'wagmi';
import { erc20Abi, formatUnits } from 'viem';
import { Wallet, X, ArrowUpRight, LogOut, Copy, Check, ShieldCheck } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useState } from 'react';
import { leagueChain, currencyLabel, wifAddress, shortWallet, isLocal } from '@/lib/config';
import { useLeagueSession } from '@/hooks/use-session';
import { useWalletDrawer } from './providers';

export function WalletButton() {
  const { address } = useAccount(); const open = useWalletDrawer();
  return <button className="wallet-button" onClick={open}><Wallet size={16} /><span>{address ? shortWallet(address) : 'Connect wallet'}</span><span className={address ? 'connection-dot on' : 'connection-dot'} /></button>;
}
export function WalletDrawer({ open, onOpenChange, restoreFocus }: { open: boolean; onOpenChange: (open: boolean) => void; restoreFocus?: () => void }) {
  const { address, chainId } = useAccount(); const { connectors, connectAsync, isPending } = useConnect();
  const { disconnect } = useDisconnect(); const { switchChainAsync } = useSwitchChain();
  const session = useLeagueSession(); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [copied, setCopied] = useState(false);
  const reduced = useReducedMotion();
  const balance = useBalance({ address, chainId: leagueChain.id, query: { enabled: Boolean(address) } });
  const token = useReadContract({ abi: erc20Abi, address: wifAddress || undefined, functionName: 'balanceOf', args: address ? [address] : undefined, chainId: leagueChain.id, query: { enabled: Boolean(address && wifAddress) } });
  async function action(fn: () => Promise<unknown>) { setError(''); setBusy(true); try { await fn(); } catch (e) { setError(e instanceof Error ? e.message.split('\n')[0] : 'Wallet action failed.'); } finally { setBusy(false); } }
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="dialog-overlay" /><Dialog.Content className="wallet-drawer" onCloseAutoFocus={event => { if (restoreFocus) { event.preventDefault(); restoreFocus(); } }}><motion.div initial={{ x: reduced ? 0 : 20, opacity: reduced ? 1 : 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: reduced ? 0 : .22 }}>
    <div className="drawer-top"><span className="eyebrow">YOUR LEAGUE PASSPORT</span><Dialog.Close className="icon-button" aria-label="Close wallet"><X size={19} /></Dialog.Close></div>
    <div className="wallet-emblem"><Wallet size={30} /></div><Dialog.Title className="drawer-title">{address ? 'Ready to compete.' : 'Your next round awaits.'}</Dialog.Title>
    <Dialog.Description className="muted">{address ? 'Manage your wallet and sign in to join free challenges.' : 'Connect your wallet to compete. Browsing is always open.'}</Dialog.Description>
    {address ? <>
      <div className="wallet-address"><span className="mono">{shortWallet(address)}</span><button className="icon-button" aria-label="Copy wallet address" onClick={() => { void navigator.clipboard.writeText(address); setCopied(true); setTimeout(() => setCopied(false), 2000); }}>{copied ? <Check size={16} /> : <Copy size={16} />}</button></div>
      <div className="wallet-balances"><div><span className="eyebrow">REWARD BALANCE</span><strong className="mono">{token.data !== undefined ? Number(formatUnits(token.data, 18)).toLocaleString(undefined, { maximumFractionDigits: 4 }) : '—'} <small>{currencyLabel}</small></strong></div><div><span className="eyebrow">GAS BALANCE</span><strong className="mono">{balance.data ? Number(balance.data.formatted).toFixed(4) : '—'} <small>ETH</small></strong></div></div>
      {(token.isError || balance.isError) && <p className="muted small">Balance unavailable. Your wallet is still connected.</p>}
      <div className="network-row"><span className="connection-dot on" />{leagueChain.name}</div>
      {chainId !== leagueChain.id && <button className="button secondary full" disabled={busy} onClick={() => void action(() => switchChainAsync({ chainId: leagueChain.id }))}>Switch network <ArrowUpRight size={16} /></button>}
      <button className="button primary full" disabled={busy} onClick={() => void action(async () => { await session.signIn(); onOpenChange(false); })}>{busy ? 'Confirm in wallet…' : session.wallet ? 'Continue to the league' : 'Sign in to compete'}<ArrowUpRight size={17} /></button>
      <button className="text-button full" onClick={() => { void session.signOut(); disconnect(); onOpenChange(false); }}><LogOut size={15} />Disconnect</button>
    </> : <div className="connector-list">{connectors.map(connector => <button className="connector" key={connector.uid} disabled={isPending || busy} onClick={() => void action(() => connectAsync({ connector }))}><Wallet size={20} /><span>{connector.name === 'Injected' ? 'Browser wallet' : connector.name}</span><ArrowUpRight size={17} /></button>)}</div>}
    {error && <p className="error-message" role="alert">{error}</p>}
    <p className="wallet-note"><ShieldCheck size={17} /><span>Players join free. {isLocal ? 'This build uses local test tokens.' : 'The platform covers registration gas.'}</span></p>
  </motion.div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
