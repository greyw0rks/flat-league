'use client';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { useAccount } from 'wagmi';
import { Copy, ArrowUpRight, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { shortWallet } from '@/lib/config';
import { Amount, Identicon, EmptyState, ErrorState, StatusBadge, PageHeading } from './ui';
import { WalletButton } from './wallet';
import type { CompetitionView } from '@shared/domain';

interface ProfileData{wallet:string;history:CompetitionView[];totalRewards:string;rewards:{competition_id:string;wallet:string;amount:string;tx_hash:string}[]}
export function Profile({wallet}:{wallet?:string}){const{address}=useAccount();const target=wallet||address;const query=useQuery({queryKey:['profile',target],queryFn:()=>api<ProfileData>('/profile/'+target),enabled:Boolean(target)});
  if(!target)return <><PageHeading eyebrow="YOUR LEAGUE RECORD" title="Every round leaves a mark." description="Your competition history and confirmed rewards, in one place."/><EmptyState title="Your profile starts with your wallet." description="Connect to view your rounds and rewards."><WalletButton/></EmptyState></>;
  if(query.error)return <ErrorState message={query.error.message} onRetry={()=>void query.refetch()}/>;const profile=query.data;
  return <div id="main"><div className="profile-header"><Identicon wallet={target} size={76}/><div><span className="eyebrow">PLAYER PASSPORT</span><h1 className="mono">{shortWallet(target)}</h1><button className="text-link" onClick={()=>void navigator.clipboard.writeText(target)}><Copy size={12}/>Copy wallet address</button></div></div><div className="profile-stats"><div className="panel profile-stat"><span className="eyebrow">COMPLETED ROUNDS</span><strong className="mono">{profile?.history.filter(c=>['submitted','abandoned'].includes(c.attemptState||'')).length||0}</strong></div><div className="panel profile-stat"><span className="eyebrow">REWARDED ROUNDS</span><strong className="mono">{profile?.rewards.length||0}</strong></div><div className="panel profile-stat"><span className="eyebrow">CONFIRMED REWARDS</span><strong><Amount value={profile?.totalRewards||'0'} className="mint"/></strong></div></div><h2 className="panel-title">Your competition history</h2>{profile?.history.length?<div className="panel history-list">{profile.history.map(c=><Link className="history-row" key={c.id} href={'/competitions/'+c.id+(c.status==='finalized'?'/results':'')}><Identicon wallet={c.creator} size={38}/><div><h3>{c.title}</h3><p>{new Date(c.startAt).toLocaleDateString()} · Knowledge Run</p></div><StatusBadge status={c.status}/><ArrowUpRight size={16}/></Link>)}</div>:<EmptyState title="The first round is yours to find." description="A short challenge. A place on the board. A reason to come back."><Link className="button primary" href="/discover">Discover challenges<ArrowRight size={16}/></Link></EmptyState>}</div>;
}
