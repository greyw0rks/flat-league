'use client';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowUpRight, Clock3, UsersRound, ArrowRight, Check, LoaderCircle, AlertCircle, Trophy, Copy, Share2 } from 'lucide-react';
import { useEffect, useState, useId, forwardRef, type ReactNode } from 'react';
import { formatUnits } from 'viem';
import { currencyLabel, explorerTx, shortWallet } from '@/lib/config';
import type { CompetitionView, CompetitionStatus } from '@shared/domain';
import { serverClockNow } from '@/lib/api';
import { enterEase, CompletionMark } from './motion';
import { GameWorld } from './game-world';

export function Amount({ value, className = '' }: { value: string; className?: string }) { const n = formatUnits(BigInt(value || '0'), 18); const [whole, decimals] = n.split('.'); return <span className={'amount mono ' + className}>{BigInt(whole).toLocaleString()}{decimals && decimals !== '0' ? '.' + decimals.slice(0, 4).replace(/0+$/, '') : ''}<small>{currencyLabel}</small></span>; }
const statuses: Record<CompetitionStatus, string> = { live: 'Live now', upcoming: 'Upcoming', awaiting: 'Awaiting results', finalized: 'Finalized', cancelled: 'Cancelled', refunded: 'Refunded', expired: 'Settlement expired' };
export function StatusBadge({ status }: { status: CompetitionStatus }) { return <span className={'status-badge ' + status}><span className="status-dot"/>{statuses[status]}</span>; }
export function Countdown({ end, prefix = '' }: { end: number; prefix?: string }) {
  const [now, setNow] = useState<number | null>(null); useEffect(() => { setNow(serverClockNow()); const timer = setInterval(() => setNow(serverClockNow()), 1000); return () => clearInterval(timer); }, []);
  if (now === null) return <span className="mono countdown">—</span>;
  const seconds = Math.max(0, Math.floor((end - now) / 1000)); const days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60), secs = seconds % 60;
  const label = days ? `${days}d ${hours}h` : hours ? `${String(hours).padStart(2, '0')}h ${String(minutes).padStart(2, '0')}m` : `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  return <span className={'mono countdown ' + (seconds < 120 && seconds > 0 ? 'urgent' : '')} title={new Date(end).toUTCString()}>{prefix}{seconds ? label : 'Closed'}</span>;
}
export function Identicon({ wallet, size = 32 }: { wallet: string; size?: number }) { const color = '#' + wallet.slice(2, 8), hue = parseInt(wallet.slice(8, 12), 16) % 360; return <span className="identicon" style={{ width: size, height: size, background: `linear-gradient(135deg,${color},hsl(${hue} 70% 65%))` }} aria-hidden="true"><svg width={size*.6} height={size*.6} viewBox="0 0 20 20"><path d="M10 1 19 6v8l-9 5-9-5V6Z" fill="none" stroke="white" strokeOpacity=".5"/><path d="M1 6l9 5 9-5M10 11v8" fill="none" stroke="white" strokeOpacity=".5"/></svg></span>; }
export function WalletIdentity({ wallet, link = true }: { wallet: string; link?: boolean }) { const inner = <><Identicon wallet={wallet}/><span className="mono">{shortWallet(wallet)}</span></>; return link ? <Link className="wallet-identity" href={'/profile/'+wallet}>{inner}</Link> : <span className="wallet-identity">{inner}</span>; }
export function ArenaIllustration({ variant = 0 }: { variant?: number }) {
  const id = useId().replaceAll(':', '');
  return <svg className={'card-art art-' + variant} viewBox="0 0 500 160" fill="none" aria-hidden="true">
    <defs><radialGradient id={id}><stop stopColor={variant === 1 ? '#8B5CF6' : variant === 2 ? '#2DD4BF' : '#3175C6'} stopOpacity=".26" /><stop offset="1" stopColor="#111827" stopOpacity="0" /></radialGradient></defs>
    <ellipse cx="345" cy="75" rx="165" ry="110" fill={'url(#' + id + ')'} />
    <path d="M0 150H500M80 0V160M180 0V160M280 0V160M380 0V160" stroke="#496782" strokeOpacity=".13" />
    <g className="card-art-object" transform="translate(351 92)">
      <ellipse cy="21" rx="111" ry="26" fill="#0b1626" stroke="currentColor" strokeOpacity=".45" />
      <ellipse cy="15" rx="94" ry="22" stroke="currentColor" strokeOpacity=".5" />
      <path d="m0-58 45 25v52L0 45-45 19v-52Z" fill="currentColor" fillOpacity=".1" stroke="currentColor" strokeOpacity=".8" />
      <path d="M0-58v103M-45-33 0-8l45-25M-45 19 0-8l45 27" stroke="currentColor" strokeOpacity=".45" />
      <ellipse cy="-13" rx="87" ry="29" transform={'rotate(' + (variant === 1 ? 30 : -27) + ')'} stroke="currentColor" />
      <ellipse cy="-13" rx="72" ry="24" transform="rotate(66)" stroke="currentColor" strokeOpacity=".45" />
      <circle cx="76" cy="-49" r="3" fill="currentColor" />
    </g>
  </svg>;
}
export const CompetitionCard = forwardRef<HTMLElement, { competition: CompetitionView; index?: number }>(function CompetitionCard({ competition: c, index = 0 }, ref) {
  const reduced = useReducedMotion();
  const label = c.attemptState === 'active' ? 'Resume your run' : c.status === 'finalized' || c.attemptId ? 'View results' : c.status === 'upcoming' ? 'View schedule' : c.status === 'live' ? 'Enter challenge' : 'View challenge';
  const href = c.attemptState === 'active' ? `/competitions/${c.id}/play` : c.status === 'finalized' || c.attemptId ? `/competitions/${c.id}/results` : `/competitions/${c.id}`;
  const variant = [...c.id].reduce((sum, char) => sum + char.charCodeAt(0), 0) % 3;
  const returned = ['cancelled', 'refunded', 'expired'].includes(c.status);
  return <motion.article ref={ref} layout={reduced ? false : 'position'} className={'competition-card ' + (c.status === 'live' ? 'is-live' : '')}
    initial={{ opacity: 1, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: reduced ? 1 : .98 }}
    transition={{ duration: reduced ? .1 : .3, delay: reduced ? 0 : Math.min(index, 5) * .04, ease: enterEase, layout: { duration: .28, delay: 0 } }}
    whileHover={reduced ? undefined : { y: -4 }}>
    <Link href={href} className="card-cover-link" aria-label={c.title} />
    <div className={'competition-art game-art-'+variant}><GameWorld kind={(['quiz','trophy','chest'] as const)[variant]} /><StatusBadge status={c.status} /><span className="card-mode eyebrow">KNOWLEDGE RUN <span className="mono">/ 120 SEC</span></span></div>
    <div className="competition-card-body"><div className="card-creator"><Identicon wallet={c.creator} size={18} /><span className="mono">{shortWallet(c.creator)}</span><span>· Creator</span></div>
      <h3 title={c.title}>{c.title}</h3><p className="card-description">{c.description}</p>
      <div className="card-facts"><span><Clock3 size={13} />10 questions</span><span><UsersRound size={13} />{c.participantCount} / {c.maxParticipants}</span><span>Free entry</span></div>
      <div className="card-bottom"><div><span className="eyebrow">{returned ? 'ORIGINAL POOL' : 'CREATOR-FUNDED POOL'}</span><Amount value={c.pool} className={c.status === 'live' ? 'mint' : ''} /></div><span className="card-arrow"><ArrowUpRight size={21} /></span></div>
      {c.joined && <span className="card-entry"><Check size={12} />{c.attemptState === 'active' ? 'Your run is in progress' : c.attemptId ? 'Your run is complete' : c.registrationStatus === 'confirmed' ? 'Your place is confirmed' : 'Your place is registering'}</span>}
      <div className="card-deadline"><strong>{label}</strong>{['live', 'upcoming'].includes(c.status) ? <span>{c.status === 'upcoming' ? 'Starts ' : 'Closes '}<Countdown end={c.status === 'upcoming' ? c.startAt : c.endAt} /></span> : <ArrowRight size={14} />}</div>
    </div>
  </motion.article>;
});
export function EmptyState({ title, description, children }: { title: string; description: string; children?: ReactNode }) { return <div className="empty-state"><span className="empty-icon"><Trophy size={28}/></span><h3>{title}</h3><p>{description}</p>{children}</div>; }
export function LoadingCards() { return <div className="competition-grid">{[0,1,2].map(i => <div key={i} className="skeleton-card"><div className="skeleton art"/><div className="skeleton line"/><div className="skeleton line short"/></div>)}</div>; }
export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <div className="error-state" role="alert"><AlertCircle size={20}/><div><strong>We couldn't load this yet.</strong><p>{message}</p></div>{onRetry && <button className="button secondary" onClick={onRetry}>Try again</button>}</div>; }
export function TxLink({ hash, children = 'View transaction' }: { hash: string; children?: ReactNode }) { const url = explorerTx(hash); return url ? <a className="text-link" href={url} target="_blank" rel="noreferrer">{children}<ArrowUpRight size={14}/></a> : <button className="text-link" onClick={() => void navigator.clipboard.writeText(hash)} title={hash}>{children}<Copy size={13}/></button>; }
export function TransactionPanel({ step, hash, error }: { step: string; hash?: string | null; error?: string }) { return <div className={'transaction-panel '+(error ? 'error' : '')} role="status"><span>{error ? <AlertCircle size={20}/> : step === 'Confirmed' || step === 'Published' ? <CompletionMark /> : <LoaderCircle size={20} className="spin"/>}</span><div><strong>{error || step}</strong>{hash && <TxLink hash={hash}>{shortWallet(hash)}</TxLink>}</div></div>; }
export function ShareButton({ title, label = 'Share challenge' }: { title: string; label?: string }) {
  const [message, setMessage] = useState('');
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 2500); return () => clearTimeout(timer); }, [message]);
  async function share() {
    try {
      if (navigator.share) await navigator.share({ title, url: window.location.href });
      else { await navigator.clipboard.writeText(window.location.href); setMessage('Link copied'); }
    } catch (error) { if (!(error instanceof Error && error.name === 'AbortError')) setMessage('Could not share link'); }
  }
  return <button className="button secondary share-button" onClick={() => void share()}><Share2 size={14} /><span aria-live="polite">{message || label}</span></button>;
}
export function PageHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description: string; children?: ReactNode }) { return <div className="page-heading" id="main"><div><span className="eyebrow mint">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{children}</div>; }
