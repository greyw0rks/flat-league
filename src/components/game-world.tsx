export type GameWorldKind = 'trophy' | 'quiz' | 'chest' | 'podium';

export function GameWorld({ kind = 'trophy', className = '', priority = false }: { kind?: GameWorldKind; className?: string; priority?: boolean }) {
  return <div className={`game-world world-${kind} ${className}`} aria-hidden="true"><img src={`/world/${kind}.webp`} alt="" width="1000" height="860" loading={priority ? 'eager' : 'lazy'} /></div>;
}
