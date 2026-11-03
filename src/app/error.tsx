'use client';
import Link from 'next/link';
export default function Error({reset}:{error:Error;reset:()=>void}){return <main className="error-page" id="main"><h1>A brief timeout.</h1><p>We couldn't load this screen. Your onchain funds and accepted answers remain recorded.</p><button className="button primary" onClick={reset}>Try again</button><Link className="button secondary" href="/discover">Discover</Link></main>;}
