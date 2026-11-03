'use client';

import { motion, useReducedMotion } from 'framer-motion';
import type { ReactNode } from 'react';

export const enterEase = [0.22, 1, 0.36, 1] as const;

export function Reveal({ children, className, delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduced = useReducedMotion();
  return <motion.div className={className} initial={{ y: 18 }} whileInView={{ y: 0 }}
    viewport={{ once: true, amount: 0.15 }} transition={{ duration: reduced ? 0 : 0.55, delay: reduced ? 0 : delay, ease: enterEase }}>
    {children}
  </motion.div>;
}

export function CompletionMark({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  return <motion.span className={'completion-mark ' + className} initial={{ scale: reduced ? 1 : 0.85 }}
    animate={{ scale: 1 }} transition={{ duration: reduced ? 0 : 0.35, ease: enterEase }} aria-hidden="true">
    <svg viewBox="0 0 64 64" fill="none">
      <circle cx="32" cy="32" r="28" stroke="currentColor" strokeOpacity=".2" />
      <motion.circle cx="32" cy="32" r="28" stroke="currentColor" strokeWidth="1.5"
        initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.5 }} />
      <motion.path d="m20 32 8 8 16-17" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: reduced ? 1 : 0 }} animate={{ pathLength: 1 }} transition={{ duration: reduced ? 0 : 0.3, delay: reduced ? 0 : 0.2 }} />
    </svg>
  </motion.span>;
}
