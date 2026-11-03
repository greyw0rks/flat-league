import type { Metadata } from 'next';
import { GeistSans } from 'geist/font/sans';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import './globals.css';
import { Providers } from '@/components/providers';
import { NetworkBanner } from '@/components/layout';

export const metadata: Metadata = { metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'https://flat-league.vercel.app'), title: { default: 'Flat League — Compete for something real.', template: '%s · Flat League' }, description: 'Free-to-enter knowledge competitions. Ten questions, two minutes, and creator-funded rewards. Join our Robinhood Chain testnet early access.', openGraph: { title: 'Flat League — Your skills. Real rewards.', description: 'Free entry. Creator-funded competitions. Performance decides.', type: 'website' } };
export default function RootLayout({ children }: { children: React.ReactNode }) { return <html lang="en" className={GeistSans.variable}><body><a className="skip-link" href="#main">Skip to content</a><Providers><NetworkBanner/>{children}</Providers></body></html>; }
