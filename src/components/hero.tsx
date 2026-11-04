'use client';

import Link from 'next/link';
import { ArrowRight, ArrowUpRight, ShieldCheck, Play, ArrowDown } from 'lucide-react';
import { GameWorld } from './game-world';
import { currencyLabel } from '@/lib/config';

export function Hero() {
  return <section className="hero game-hero" id="main" aria-labelledby="hero-title">
    <div className="hero-copy">
      <div className="hero-eyebrow"><span className="live-signal" />A LITTLE PLAY. A BIG REASON TO RETURN.</div>
      <h1 id="hero-title">Your knowledge.<br /><span>A place on the podium.</span></h1>
      <p>Ten questions. Two minutes. One chance to make your mark.<br />Play for free in creator-funded competitions.</p>
      <div className="hero-actions"><Link href="/discover" className="button primary large"><Play size={18} />Enter the league<ArrowRight size={18} /></Link><Link href="/create" className="text-link">Create a challenge<ArrowUpRight size={16} /></Link></div>
      <div className="hero-format" aria-label="Knowledge Run format"><div><strong className="mono">10</strong><span>QUESTIONS</span></div><div><strong className="mono">02:00</strong><span>ON THE CLOCK</span></div><div><strong className="mono">01</strong><span>SHOT PER ROUND</span></div></div>
      <div className="hero-proof"><ShieldCheck size={16} /><span>Free entry · Creator-funded {currencyLabel} · Performance decides</span></div>
    </div>
    <div className="hero-art"><GameWorld kind="trophy" priority /><span className="world-caption">Your next challenge is a little adventure.</span></div>
    <div className="hero-bottom"><span>Every player. The same playing field.</span><Link href="#challenges" className="scroll-label">FIND YOUR NEXT CHALLENGE<ArrowDown size={14} /></Link></div>
  </section>;
}
