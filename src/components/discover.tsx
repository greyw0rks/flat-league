'use client';
import { useId, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { Search, Plus, Trophy, UsersRound, Radio, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';
import { useLeagueSession } from '@/hooks/use-session';
import { CompetitionCard, PageHeading, Amount, EmptyState, LoadingCards, ErrorState } from './ui';
import { WalletButton } from './wallet';
import type { CompetitionView } from '@shared/domain';

export function Discover({ initial, mine=false }: { initial?: CompetitionView[]; mine?: boolean }){
  const [filter,setFilter]=useState('all');const [search,setSearch]=useState('');const session=useLeagueSession();
  const filterId=useId();const reduced=useReducedMotion();
  const query=useQuery({queryKey:['competitions',session.wallet],queryFn:()=>api<{competitions:CompetitionView[]}>('/competitions'),initialData:initial?{competitions:initial}:undefined,refetchInterval:8000});
  const all=query.data?.competitions||[];const own=all.filter(c=>c.joined||c.creator.toLowerCase()===session.wallet?.toLowerCase());const competitions=mine?own:all;
  const filtered=competitions.filter(c=>(filter==='all'||(filter==='finished'?['finalized','refunded','cancelled'].includes(c.status):c.status===filter))&&(c.title.toLowerCase().includes(search.toLowerCase())||c.description.toLowerCase().includes(search.toLowerCase())));
  const active=all.filter(c=>['live','upcoming'].includes(c.status));const totalPool=active.reduce((s,c)=>s+BigInt(c.pool),0n);
  return <><PageHeading eyebrow={mine?'YOUR ROUNDS. YOUR RECORD.':'FIND YOUR COMPETITIVE EDGE'} title={mine?'My competitions':'The arena is open.'} description={mine?'The rounds you create and the challenges you take on.':'Pick your challenge. Test your skills. Compete for creator-funded rewards.'}><Link href="/create" className="button secondary"><Plus size={15}/>Create challenge</Link></PageHeading>
  {!mine&&<div className="discovery-stats"><div className="discovery-stat"><span className="stat-icon"><Radio size={19}/></span><div><span className="eyebrow">LIVE CHALLENGES</span><strong className="mono">{all.filter(c=>c.status==='live').length.toString().padStart(2,'0')}</strong></div></div><div className="discovery-stat"><span className="stat-icon"><Trophy size={19}/></span><div><span className="eyebrow">ACTIVE REWARD POOLS</span><strong><Amount value={totalPool.toString()}/></strong></div></div><div className="discovery-stat"><span className="stat-icon"><UsersRound size={19}/></span><div><span className="eyebrow">CONFIRMED ENTRIES</span><strong className="mono">{all.reduce((s,c)=>s+c.participantCount,0)}</strong></div></div></div>}
  {mine&&!session.wallet?<EmptyState title="Your league starts here." description="Sign in with your wallet to find your competitions and saved runs."><WalletButton/></EmptyState>:<><div className="filter-bar"><div className="tabs" role="group" aria-label="Filter competitions by status">{[{id:'all',label:'All rounds'},{id:'live',label:'Live'},{id:'upcoming',label:'Upcoming'},{id:'finished',label:'Finished'}].map(t=><button key={t.id} className={'tab '+(filter===t.id?'active':'')} aria-pressed={filter===t.id} onClick={()=>setFilter(t.id)}>{filter===t.id&&<motion.span className="tab-indicator" layoutId={filterId+'-active'} transition={{duration:reduced?0:.24,ease:[.22,1,.36,1]}}/>}<span>{t.label}</span></button>)}</div><label className="search-field"><Search size={15}/><input aria-label="Search competitions" placeholder="Find a challenge…" value={search} onChange={e=>setSearch(e.target.value)}/></label></div>
  <div className="discovery-list-heading"><span className="eyebrow">{filter==='live'?'IN PLAY NOW':filter==='upcoming'?'UP NEXT':filter==='finished'?'THE FINISH LINE':'CHOOSE YOUR CHALLENGE'}</span><span className="mono" role="status">{query.isLoading?'Loading rounds…':filtered.length+' '+(filtered.length===1?'round':'rounds')}</span></div>
  {query.isLoading?<LoadingCards/>:query.error?<ErrorState message={query.error.message} onRetry={()=>void query.refetch()}/>:filtered.length?<div className="competition-grid"><AnimatePresence mode="popLayout">{filtered.map((c,i)=><CompetitionCard key={c.id} competition={c} index={i}/>)}</AnimatePresence></div>:<EmptyState title={search?'No rounds match your search.':mine?'Your first round is still ahead.':'The next round is being prepared.'} description={search?'Try another title or clear your filters.':mine?'Join a live challenge or create a round for your community.':'Creators bring the challenge. Players bring the skills. Be the first to start a round.'}>{search||filter!=='all'?<button className="button secondary" onClick={()=>{setSearch('');setFilter('all');}}>Clear filters</button>:<Link className="button primary" href={mine?'/discover':'/create'}>{mine?'Discover challenges':'Create a challenge'}<ArrowRight size={16}/></Link>}</EmptyState>}</>}
  </>;
}
