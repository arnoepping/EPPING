import { mountPlayer } from './panels.ts';

function hasWebGL(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function boot(): void {
  const root = document.querySelector<HTMLElement>('.xp');
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !hasWebGL()) {
    // Fallback: players appear as panels scroll into view.
    const io = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) { mountPlayer(e.target as HTMLElement); io.unobserve(e.target); }
    }), { rootMargin: '200px' });
    root.querySelectorAll('.panel').forEach((p) => io.observe(p));
    return;
  }
  document.documentElement.classList.add('xp-3d');
  import('./app.ts').then((m) => m.start(root)).catch((err) => {
    console.error(err);
    document.documentElement.classList.remove('xp-3d');
  });
}
