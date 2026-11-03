'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, ShieldCheck, Pause, Play, ArrowDown } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ArenaPoster } from './3d/arena-poster';
import { enterEase } from './motion';
import { currencyLabel } from '@/lib/config';

const ArenaScene = dynamic(() => import('./3d/arena-scene'), { ssr: false, loading: () => <ArenaPoster /> });

export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduced = useReducedMotion();
  const [paused, setPaused] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [sceneAvailable, setSceneAvailable] = useState(true);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (reduced || paused) return;
    let cleanup = () => {}, disposed = false;
    void Promise.all([import('gsap'), import('gsap/ScrollTrigger')]).then(([{ gsap }, { ScrollTrigger }]) => {
      if (disposed || !ref.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const media = gsap.matchMedia();
      media.add('(min-width: 768px)', () => {
        const context = gsap.context(() => {
          gsap.to('.hero-art', { y: 45, ease: 'none', scrollTrigger: { trigger: ref.current, start: 'top top', end: 'bottom top', scrub: 0.6 } });
        }, ref);
        return () => context.revert();
      });
      cleanup = () => media.revert();
    });
    return () => { disposed = true; cleanup(); };
  }, [reduced, paused]);

  return <section className="hero" ref={ref} id="main" aria-labelledby="hero-title">
    <div className="hero-grid" aria-hidden="true" />
    <div className="hero-copy">
      <div className="hero-eyebrow"><span className="hero-label-line" />THE WORLD IS YOUR PLAYING FIELD</div>
      <h1 id="hero-title"><span className="hero-title-line"><span>YOUR SKILLS.</span></span>
        <span className="hero-title-line"><span className="hero-rewards">REAL REWARDS.</span></span></h1>
      <p>A short challenge. A creator-funded prize pool.<br />Bring your knowledge. Earn your place.</p>
      <div className="hero-actions"><Link href="/discover" className="button primary large">Enter the league<ArrowRight size={19} /></Link>
        <Link href="/create" className="text-link">Create a challenge<ArrowUpRight size={16} /></Link></div>
      <div className="hero-format" aria-label="Knowledge Run format">
        <div><strong className="mono">10</strong><span>QUESTIONS</span></div>
        <div><strong className="mono">02:00</strong><span>ON THE CLOCK</span></div>
        <div><strong className="mono">01</strong><span>SHOT PER ROUND</span></div>
      </div>
      <div className="hero-proof"><ShieldCheck size={15} /><span>Free entry. Creator-funded {currencyLabel}. Performance decides.</span></div>
    </div>
    <div className="hero-art">
      <motion.div className="arena-light" aria-hidden="true" initial={{ scale: 0.88 }} animate={{ scale: 1 }} transition={{ duration: reduced ? 0 : 0.9, ease: enterEase }} />
      <div className="arena-reticle" aria-hidden="true"><span /><span /><span /><span /></div>
      <ArenaScene paused={paused} onAvailabilityChange={setSceneAvailable} />
      <div className="arena-caption"><span className="arena-caption-line" /><span className="mono">FLAT CORE / 001</span><span className="arena-caption-line" /></div>
      <div className="arena-coordinate mono">EVERYONE. SAME FIELD.</div>
      {mounted && !reduced && sceneAvailable && <button className="arena-motion-control" onClick={() => setPaused(value => !value)} aria-label={paused ? 'Play arena animation' : 'Pause arena animation'} aria-pressed={paused}>
        {paused ? <Play size={12} /> : <Pause size={12} />}<span>{paused ? 'Play' : 'Pause'} motion</span>
      </button>}
    </div>
    <div className="hero-bottom"><span className="mono">A LEVEL PLAYING FIELD.</span><Link href="#challenges" className="scroll-label">FIND YOUR NEXT CHALLENGE<ArrowDown size={14} /></Link></div>
  </section>;
}
