'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Compass, Trophy, Plus, UserRound, ArrowUpRight, CircleHelp, LayoutGrid, Radio, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { WalletButton } from './wallet';
import { useAccount } from 'wagmi';
import { leagueChain, isLocal, configured, currencyLabel, chainId } from '@/lib/config';

export function Logo({ compact = false }: { compact?: boolean }) { return <Link href="/" className="logo" aria-label="Flat League home"><svg width="34" height="27" viewBox="0 0 38 30" fill="none" aria-hidden="true"><ellipse cx="19" cy="15" rx="17" ry="8.5" transform="rotate(-25 19 15)" stroke="currentColor" strokeWidth="1.8"/><path d="M3 15h32" stroke="currentColor" strokeWidth="1.8"/></svg>{!compact && <span>FLAT LEAGUE<span className="logo-period">.</span></span>}</Link>; }
export function NetworkBanner() {
  if (!isLocal && chainId !== 46630 && configured) return null;
  return <div className="network-banner"><span className="connection-dot" />{isLocal ? `LOCAL PLAYGROUND · ${currencyLabel} test tokens · transactions have no real value` : configured ? 'ROBINHOOD TESTNET · free entry · MockWIF test rewards' : 'TESTNET EARLY ACCESS · competition deployment in progress'}</div>;
}
export function PublicHeader() { return <header className="public-header"><Logo /><nav aria-label="Main navigation"><Link href="/discover">Discover</Link><Link href="/leaderboard">Rankings</Link></nav><div className="header-actions"><Link className="text-link create-nav" href="/create">Create challenge <ArrowUpRight size={15}/></Link><WalletButton /></div></header>; }
const nav = [{ href: '/discover', label: 'Discover', icon: Compass }, { href: '/my-competitions', label: 'My competitions', icon: LayoutGrid }, { href: '/leaderboard', label: 'Rankings', icon: Trophy }, { href: '/create', label: 'Create challenge', icon: Plus }];
export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname(); const { address } = useAccount();
  if (path.endsWith('/play')) return <>{children}</>;
  const profile = address ? `/profile/${address}` : '/profile';
  return <div className="app-shell"><aside className="sidebar"><Logo /><div className="sidebar-label eyebrow">THE ARENA</div><nav aria-label="Arena navigation">{nav.map(item => <Link key={item.href} href={item.href} className={'sidebar-link ' + (path.startsWith(item.href) ? 'active' : '')}><item.icon size={19}/><span>{item.label}</span>{item.href === '/discover' && <span className="nav-live"/>}</Link>)}</nav><div className="sidebar-bottom"><div className="network-card"><Radio size={17}/><span>{leagueChain.name}<small>{isLocal ? 'Local test network' : 'Onchain settlement'}</small></span></div><Link href="/rules" className="sidebar-link"><CircleHelp size={18}/><span>How it works</span></Link><span className="sidebar-version">FLAT LEAGUE / EARLY ACCESS</span></div></aside><div className="app-body"><header className="app-topbar"><div className="mobile-logo"><Logo compact /></div><div className="topbar-context"><span className="connection-dot on"/> <span>THE LEAGUE IS OPEN</span></div><div className="header-actions"><Link href={profile} className="icon-button profile-nav" aria-label="Your profile"><UserRound size={18}/></Link><WalletButton/></div></header><main className="app-content">{children}</main><footer className="app-footer"><span>Performance decides. {currencyLabel} powers the rewards.</span><span><ShieldCheck size={13}/> Settled onchain</span></footer></div><nav className="bottom-nav" aria-label="Mobile navigation">{[{ href: '/discover', label: 'Discover', icon: Compass }, { href: '/leaderboard', label: 'Rankings', icon: Trophy }, { href: '/create', label: 'Create', icon: Plus }, { href: profile, label: 'You', icon: UserRound }].map(item => <Link key={item.label} href={item.href} className={path.startsWith(item.href) ? 'active' : ''}><item.icon size={20}/><span>{item.label}</span></Link>)}</nav></div>;
}
