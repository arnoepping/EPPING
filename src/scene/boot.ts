import { mountOnView } from './panels.ts';

function hasWebGL(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function boot(): void {
  const root = document.querySelector<HTMLElement>('.xp');
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !hasWebGL()) return mountOnView(root);
  // app.ts adds `xp-3d` once the stage exists, so the static page stays usable while the chunk loads.
  import('./app.ts').then((m) => m.start(root)).catch((err) => {
    console.error(err);
    document.documentElement.classList.remove('xp-3d', 'xp-ready');
    mountOnView(root);
  });
}
