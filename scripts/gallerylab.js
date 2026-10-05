// Gallery lab: preview-only switcher (injected by scripts/preview-artifact.sh) for the three gallery/lightbox pitches.
(() => {
  const SETS = [
    { name: '1 · Strip', gal: 'strip', fx: '' },
    { name: '2 · Hero', gal: 'hero', fx: '' },
    { name: '3 · Strip + glitch', gal: 'strip', fx: 'glitch' },
    { name: '3 · Hero + glitch', gal: 'hero', fx: 'glitch' },
  ];
  const r = document.documentElement;
  let i = 0;
  try { i = Math.max(0, SETS.findIndex((s) => s.name === localStorage.getItem('gallab'))); } catch {}
  const css = document.createElement('style');
  css.textContent = `.gl{position:fixed;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:99999;display:flex;align-items:center;gap:4px;
    font:500 12px/1.2 system-ui,-apple-system,sans-serif;color:#fff;background:rgba(10,6,14,.82);backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px;box-shadow:0 6px 24px rgba(0,0,0,.4)}
  .gl button{all:unset;cursor:pointer;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;font-size:15px}
  .gl button:hover{background:rgba(255,255,255,.12)} .gl b{min-width:120px;text-align:center;font-size:12px}
  .gl small{display:block;font-size:9.5px;opacity:.6;font-weight:400}`;
  document.head.appendChild(css);
  const el = document.createElement('div'); el.className = 'gl';
  el.innerHTML = '<button aria-label="Previous gallery style">‹</button><b></b><button aria-label="Next gallery style">›</button>';
  const set = (n) => {
    i = (n + SETS.length) % SETS.length; const s = SETS[i];
    r.dataset.gal = s.gal; if (s.fx) r.dataset.galFx = s.fx; else delete r.dataset.galFx;
    el.querySelector('b').innerHTML = s.name + '<small>gallery style</small>';
    try { localStorage.setItem('gallab', s.name); } catch {}
  };
  el.children[0].onclick = () => set(i - 1); el.children[2].onclick = () => set(i + 1);
  document.body.appendChild(el); set(i);
})();
