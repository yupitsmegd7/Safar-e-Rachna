'use client';

import {memo, useEffect, useState, type CSSProperties} from 'react';

// Stable positions keep hydration deterministic and avoid restarting on journal edits.
const leaves = Array.from({length: 44}, (_, i) => ({
  top: -28 + (i * 17) % 58,
  size: 18 + (i * 7) % 23,
  duration: 3.1 + (i * 1.3) % 2.4,
  delay: -(i * 1.37),
  sway: .7 + (i % 5) * .23,
  turn: 1.2 + (i % 7) * .35,
}));

export function useAutumnPreference() {
  const [enabled, setEnabled] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    try { setEnabled(localStorage.getItem('rachna-autumn-leaves') !== 'off'); }
    catch { setEnabled(true); }
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);
  function change(value: boolean) {
    setEnabled(value);
    try { localStorage.setItem('rachna-autumn-leaves', value ? 'on' : 'off'); }
    catch { /* The control still works when browser storage is unavailable. */ }
  }
  return {enabled, reducedMotion, change};
}

export const AutumnLeaves = memo(function AutumnLeaves({enabled}: {enabled: boolean}) {
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    const sync = () => setPaused(document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
  if (!enabled) return null;
  return <div className="autumn-leaves" aria-hidden="true" data-paused={paused}>
    {leaves.map((leaf, i) => <span className="autumn-leaf" key={i} style={{
      top: `${leaf.top}%`,
      '--leaf-size': `${leaf.size}px`,
      '--leaf-duration': `${leaf.duration}s`,
      '--leaf-delay': `${leaf.delay}s`,
      '--leaf-sway': `${leaf.sway}s`,
      '--leaf-turn': `${leaf.turn}s`,
    } as CSSProperties}>
      <span className="autumn-leaf-sway"><img
        src={i % 3 === 0 ? '/autumn/fallen-leaves.svg' : '/autumn/maple-leaf.svg'}
        alt="" width={leaf.size} height={leaf.size} draggable={false}
      /></span>
    </span>)}
  </div>;
});
