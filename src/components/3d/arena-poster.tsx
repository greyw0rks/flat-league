'use client';
import { useId } from 'react';

export function ArenaPoster() {
  const id = useId().replaceAll(':', '');
  return <svg viewBox="0 0 600 500" className="arena-poster" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id={id + '-face'} x1="-80" y1="-110" x2="80" y2="110" gradientUnits="userSpaceOnUse"><stop stopColor="#4b86ad" /><stop offset=".4" stopColor="#1c405f" /><stop offset="1" stopColor="#0c1a2e" /></linearGradient>
      <linearGradient id={id + '-base'} x1="300" y1="365" x2="300" y2="420" gradientUnits="userSpaceOnUse"><stop stopColor="#1b3852" /><stop offset="1" stopColor="#091422" /></linearGradient>
      <radialGradient id={id + '-floor'}><stop stopColor="#297fa0" stopOpacity=".22" /><stop offset="1" stopColor="#080b12" stopOpacity="0" /></radialGradient>
    </defs>
    <ellipse cx="300" cy="404" rx="235" ry="56" fill={'url(#' + id + '-floor)'} />
    <path d="M124 370v15c0 48 352 48 352 0v-15" fill={'url(#' + id + '-base)'} stroke="#254360" />
    <ellipse cx="300" cy="370" rx="176" ry="42" fill="#0e2033" stroke="#3c709d" />
    <ellipse cx="300" cy="362" rx="153" ry="35" fill="#13283b" stroke="#69a8ce" strokeOpacity=".7" />
    <ellipse cx="300" cy="362" rx="112" ry="25" stroke="#497290" strokeDasharray="3 9" />
    <path d="m240 353 60-14 60 14-60 14Z" stroke="#3c6687" />
    <g transform="translate(300 217)">
      <ellipse rx="191" ry="63" transform="rotate(-28)" stroke="#77baff" strokeWidth="1.7" />
      <ellipse rx="161" ry="63" transform="rotate(57)" stroke="#a38af8" strokeWidth="1.6" />
      <path d="m0-116 86 43v121L0 110-86 50V-73Z" fill={'url(#' + id + '-face)'} stroke="#7cabc8" strokeWidth="1.2" />
      <path d="M0-116v226M-86-73 0-24 86-73M-86 50 0-24 86 48M0-24v134" stroke="#8cb3ce" strokeOpacity=".55" />
      <path d="m0-116 86 43L0-24-86-73Z" fill="#71abd0" fillOpacity=".13" />
      <path d="M0-24 86-73v121L0 110Z" fill="#071422" fillOpacity=".32" />
      <ellipse rx="169" ry="59" transform="rotate(-66)" stroke="#4ac9ba" strokeWidth="1.4" />
      <circle cx="169" cy="-90" r="5" fill="#acd8fc" /><circle cx="-85" cy="-137" r="4" fill="#b6a0ff" /><circle cx="-56" cy="130" r="4" fill="#6be0cf" />
    </g>
    <g fill="#8fb3cc" fillOpacity=".65"><circle cx="122" cy="151" r="1.2" /><circle cx="436" cy="115" r="1.2" /><circle cx="490" cy="286" r="1.5" /><circle cx="155" cy="297" r="1" /><circle cx="381" cy="59" r="1" /><circle cx="190" cy="74" r="1" /></g>
  </svg>;
}
