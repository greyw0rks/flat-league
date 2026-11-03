'use client';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef, useState, useEffect, Component, type ReactNode } from 'react';
import { useInView, useReducedMotion } from 'framer-motion';
import * as THREE from 'three';
import { ArenaPoster } from './arena-poster';

function Core() {
  const group = useRef<THREE.Group>(null);
  const phase = useRef(0);
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { base: { value: new THREE.Color('#122b43') }, glow: { value: new THREE.Color('#559ac5') } },
    vertexShader: `varying vec3 vNormal; varying vec3 vPosition; void main(){ vNormal=normalize(normalMatrix*normal); vec4 p=modelViewMatrix*vec4(position,1.0); vPosition=p.xyz; gl_Position=projectionMatrix*p; }`,
    fragmentShader: `uniform vec3 base; uniform vec3 glow; varying vec3 vNormal; varying vec3 vPosition; void main(){ vec3 n=normalize(cross(dFdx(vPosition),dFdy(vPosition))); if(!gl_FrontFacing)n=-n; float light=max(0.,dot(n,normalize(vec3(-.5,.8,1.)))); float fresnel=pow(1.-max(0.,dot(n,normalize(-vPosition))),2.4); vec3 c=base+glow*(light*.7+fresnel*.8); gl_FragColor=vec4(c,1.); }`
  }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((_, delta) => { phase.current += Math.min(delta, .05); if (group.current) { group.current.rotation.y = phase.current * .12; group.current.position.y = .3 + Math.sin(phase.current * .6) * .07; } });
  return <group ref={group} position={[0,.3,0]}><mesh material={material}><icosahedronGeometry args={[1.18,1]}/></mesh><mesh scale={1.001}><icosahedronGeometry args={[1.18,1]}/><meshBasicMaterial color="#6199b6" transparent opacity={.19} wireframe/></mesh></group>;
}
function Orbit({ radius, color, rotation, speed }: { radius: number; color: string; rotation: [number, number, number]; speed: number }) {
  const satellite = useRef<THREE.Group>(null), phase = useRef(0);
  useFrame((_, delta) => { phase.current += Math.min(delta, .05) * speed; if (satellite.current) satellite.current.rotation.z = phase.current; });
  return <group rotation={rotation}><mesh><torusGeometry args={[radius, .012, 6, 96]} /><meshBasicMaterial color={color} /></mesh>
    <group ref={satellite}><mesh position={[radius, 0, 0]}><sphereGeometry args={[.046, 12, 8]} /><meshBasicMaterial color={color} /></mesh></group>
  </group>;
}
function Rings() {
  return <group position={[0,.3,0]}>
    <Orbit radius={1.95} color="#77baff" rotation={[1.1, .4, .35]} speed={.2} />
    <Orbit radius={1.75} color="#a38af8" rotation={[.1, .7, -.75]} speed={-.14} />
    <Orbit radius={2.02} color="#4ac9ba" rotation={[.2, -.7, .75]} speed={.12} />
  </group>;
}
function Platform() { return <group position={[0,-1.15,0]}>{[{ radius: 1.9, y: -.18 }, { radius: 1.65, y: -.04 }, { radius: 1.3, y: .1 }].map((p,i) => <group key={i} position={[0,p.y,0]}><mesh><cylinderGeometry args={[p.radius,p.radius,.12,64]}/><meshStandardMaterial color={i === 2 ? '#13263b' : '#0e1929'} metalness={.6} roughness={.5}/></mesh><mesh rotation={[Math.PI/2,0,0]} position={[0,.06,0]}><torusGeometry args={[p.radius,.012,6,80]}/><meshBasicMaterial color={i === 1 ? '#64b2f9' : '#2564a8'}/></mesh></group>)}</group>; }
function Particles({ count }: { count: number }) {
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => { const result = new Float32Array(count*3); let seed = 27; const random = () => { seed = (seed*1664525+1013904223)>>>0; return seed/4294967296; }; for(let i=0;i<count;i++){const r=2+random()*1.1,a=random()*Math.PI*2;result[i*3]=Math.cos(a)*r;result[i*3+1]=(random()-.5)*3.6;result[i*3+2]=Math.sin(a)*r;}return result;},[count]);
  useFrame((_,delta)=>{if(points.current)points.current.rotation.y+=Math.min(delta,.05)*.025;});
  return <points ref={points}><bufferGeometry><bufferAttribute attach="attributes-position" args={[positions,3]}/></bufferGeometry><pointsMaterial size={.018} color="#78a2c0" transparent opacity={.65} sizeAttenuation/></points>;
}
function Scene({ mobile }: { mobile: boolean }) { const group=useRef<THREE.Group>(null); useFrame((state, delta)=>{if(group.current&&!mobile){group.current.rotation.y=THREE.MathUtils.damp(group.current.rotation.y,state.pointer.x*.11,3,Math.min(delta,.05));group.current.rotation.x=THREE.MathUtils.damp(group.current.rotation.x,-state.pointer.y*.06,3,Math.min(delta,.05));}});return <group ref={group}><ambientLight intensity={1.1}/><directionalLight position={[-3,5,3]} intensity={3} color="#6aa7ef"/><pointLight position={[3,1,-2]} intensity={6} color="#8b5cf6"/><Core/><Rings/><Platform/><Particles count={mobile?36:90}/></group>; }

class SceneBoundary extends Component<{children:ReactNode;fallback:ReactNode;onFailure:()=>void},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return{failed:true};}componentDidCatch(){this.props.onFailure();}render(){return this.state.failed?this.props.fallback:this.props.children;}}
export default function ArenaScene({ paused = false, onAvailabilityChange }: { paused?: boolean; onAvailabilityChange?: (available: boolean) => void }) {
  const ref = useRef<HTMLDivElement>(null), visible = useInView(ref, { amount: .1 }), reduced = useReducedMotion();
  const [active, setActive] = useState(true), [mobile, setMobile] = useState(false), [failed, setFailed] = useState(false), [mounted, setMounted] = useState(false);
  useEffect(() => {
    const update = () => setActive(!document.hidden), resize = () => setMobile(window.matchMedia('(pointer: coarse), (max-width: 767px)').matches);
    update(); resize(); setMounted(true);
    document.addEventListener('visibilitychange', update); window.addEventListener('resize', resize);
    return () => { document.removeEventListener('visibilitychange', update); window.removeEventListener('resize', resize); };
  }, []);
  const running = visible && active && !paused;
  const fallback = reduced || failed || !mounted;
  useEffect(() => { if (failed) onAvailabilityChange?.(false); }, [failed, onAvailabilityChange]);
  return <div ref={ref} className="arena-canvas" aria-hidden="true" data-motion-state={fallback ? 'static' : running ? 'running' : 'paused'}>
    {fallback ? <ArenaPoster /> : <SceneBoundary fallback={<ArenaPoster />} onFailure={() => setFailed(true)}><Canvas fallback={<ArenaPoster />} camera={{ position: [0, 1.3, 6.8], fov: 35 }}
      dpr={mobile ? 1 : [1, 1.5]} frameloop={running ? 'always' : 'never'} gl={{ antialias: !mobile, alpha: true, powerPreference: 'low-power' }}
      onCreated={({ gl }) => { onAvailabilityChange?.(true); gl.domElement.addEventListener('webglcontextlost', () => setFailed(true), { once: true }); }}><Scene mobile={mobile} /></Canvas></SceneBoundary>}
  </div>;
}
