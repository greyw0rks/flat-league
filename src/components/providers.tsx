'use client';
import { createContext, useContext, useRef, useState, type ReactNode } from 'react';
import { WagmiProvider, createConfig, http } from 'wagmi';
import { injected, walletConnect } from 'wagmi/connectors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { leagueChain, rpcUrl } from '@/lib/config';
import { WalletDrawer } from './wallet';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID;
const config = createConfig({ chains: [leagueChain], connectors: [injected(), ...(projectId ? [walletConnect({ projectId, showQrModal: true })] : [])], transports: { [leagueChain.id]: http(rpcUrl) }, ssr: true });
const WalletContext = createContext<() => void>(() => {});
export const useWalletDrawer = () => useContext(WalletContext);
export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, staleTime: 5000, refetchOnWindowFocus: true } } }));
  const [walletOpen, setWalletOpen] = useState(false);
  const walletTrigger = useRef<HTMLElement | null>(null);
  function openWallet() { walletTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; setWalletOpen(true); }
  function restoreWalletFocus() { const target = walletTrigger.current?.isConnected ? walletTrigger.current : document.querySelector<HTMLElement>('.wallet-button'); target?.focus(); }
  return <WagmiProvider config={config}><QueryClientProvider client={queryClient}><MotionConfig reducedMotion="user"><WalletContext.Provider value={openWallet}>{children}<WalletDrawer open={walletOpen} onOpenChange={setWalletOpen} restoreFocus={restoreWalletFocus} /></WalletContext.Provider></MotionConfig></QueryClientProvider></WagmiProvider>;
}
