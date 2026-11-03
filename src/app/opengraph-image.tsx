import { ImageResponse } from 'next/og';
export const alt = 'Flat League — Your skills. Real rewards.';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export default function Image() {
  return new ImageResponse(<div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: 70, background: '#0c1110', color: '#f0f4f1' }}>
    <div style={{ display: 'flex', fontSize: 28, letterSpacing: 2 }}>FLAT LEAGUE.</div>
    <div style={{ display: 'flex', flexDirection: 'column', fontSize: 88, lineHeight: 1.04, letterSpacing: -4 }}><span>YOUR SKILLS.</span><span style={{ color: '#c1f7d6' }}>REAL REWARDS.</span></div>
    <div style={{ display: 'flex', fontSize: 22, color: '#a4b4ac' }}>10 questions. 02:00 on the clock. Free entry. Testnet early access.</div>
  </div>, size);
}
