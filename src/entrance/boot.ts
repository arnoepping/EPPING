// Load the 3D entrance only when the device can do it; otherwise the static page (already rendered) stays.
function hasWebGL(): boolean {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}

export function boot(): void {
  const root = document.querySelector<HTMLElement>('.ent');
  if (!root || matchMedia('(prefers-reduced-motion: reduce)').matches || !hasWebGL()) return;
  import('./app.ts').then((m) => m.start(root)).catch((err) => {
    console.error(err);
    document.documentElement.classList.remove('ent-3d', 'ent-locked', 'ent-boot');
  });
}
