// Font lab: preview-only switcher (injected by scripts/preview-artifact.sh, never part of the site build).
// Swaps the three type roles (--display headings, --body text, --mono labels/buttons). The logo is an outlined SVG and never changes.
(() => {
  const SETS = [
    { name: 'Now', note: 'Unbounded \u00b7 Archivo \u00b7 JetBrains Mono', display: 'Unbounded', body: 'Archivo', mono: 'JetBrains Mono', fonts: [] },
    { name: 'Warehouse', note: 'Syne \u00b7 Familjen Grotesk \u00b7 Martian Mono', display: 'Syne', body: 'Familjen Grotesk', mono: 'Martian Mono', fonts: ['Syne:wght@700;800', 'Familjen+Grotesk:wght@400;500;600', 'Martian+Mono:wght@400;500'] },
    { name: 'Techno poster', note: 'Big Shoulders Display \u00b7 Chivo \u00b7 Chivo Mono', display: 'Big Shoulders Display', body: 'Chivo', mono: 'Chivo Mono', fonts: ['Big+Shoulders+Display:wght@800;900', 'Chivo:wght@400;500;600', 'Chivo+Mono:wght@400;500'] },
    { name: 'Gig flyer', note: 'Dela Gothic One \u00b7 Schibsted Grotesk \u00b7 Sometype Mono', display: 'Dela Gothic One', body: 'Schibsted Grotesk', mono: 'Sometype Mono', fonts: ['Dela+Gothic+One', 'Schibsted+Grotesk:wght@400;500;600', 'Sometype+Mono:wght@400;500'] },
    { name: 'Bubbly', note: 'Bricolage Grotesque \u00b7 Bricolage Grotesque \u00b7 Azeret Mono', display: 'Bricolage Grotesque', body: 'Bricolage Grotesque', mono: 'Azeret Mono', fonts: ['Bricolage+Grotesque:opsz,wght@12..96,400;12..96,500;12..96,800', 'Azeret+Mono:wght@400;500'] },
    { name: 'Arcade', note: 'Tilt Warp \u00b7 Hanken Grotesk \u00b7 Silkscreen', display: 'Tilt Warp', body: 'Hanken Grotesk', mono: 'Silkscreen', fonts: ['Tilt+Warp', 'Hanken+Grotesk:wght@400;500;600', 'Silkscreen'] },
    { name: 'Y2K chrome', note: 'Krona One \u00b7 Albert Sans \u00b7 Doto', display: 'Krona One', body: 'Albert Sans', mono: 'Doto', fonts: ['Krona+One', 'Albert+Sans:wght@400;500;600', 'Doto:wght@700;800'] },
  ];
  const root = document.documentElement, loaded = new Set();
  const load = (s) => {
    if (!s.fonts.length || loaded.has(s.name)) return; loaded.add(s.name);
    const l = document.createElement('link'); l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?' + s.fonts.map((f) => 'family=' + f).join('&') + '&display=swap';
    document.head.appendChild(l);
  };
  let i = 0;
  try { i = Math.max(0, SETS.findIndex((s) => s.name === localStorage.getItem('fontlab'))); } catch {}
  const css = document.createElement('style');
  css.textContent = `
  .fl{position:fixed;left:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:99999;display:flex;align-items:center;gap:4px;
    font:500 12px/1.2 system-ui,-apple-system,sans-serif;color:#fff;background:rgba(10,6,14,.82);backdrop-filter:blur(8px);
    border:1px solid rgba(255,255,255,.18);border-radius:999px;padding:4px;box-shadow:0 6px 24px rgba(0,0,0,.4)}
  .fl button{all:unset;cursor:pointer;width:30px;height:30px;display:grid;place-items:center;border-radius:50%;font-size:15px}
  .fl button:hover{background:rgba(255,255,255,.12)}
  .fl .fl-t{min-width:118px;text-align:center;padding:0 4px}
  .fl .fl-t b{display:block;font-size:12px}.fl .fl-t small{display:block;font-size:9.5px;opacity:.6;max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
  document.head.appendChild(css);
  const ui = document.createElement('div'); ui.className = 'fl';
  ui.innerHTML = '<button type="button" aria-label="Previous fonts">\u2039</button><div class="fl-t"><b></b><small></small></div><button type="button" aria-label="Next fonts">\u203a</button>';
  const [prev, next] = ui.querySelectorAll('button'), title = ui.querySelector('b'), note = ui.querySelector('small');
  const apply = () => {
    const s = SETS[i]; load(s);
    if (i === 0) { ['--display', '--body', '--mono'].forEach((v) => root.style.removeProperty(v)); root.style.removeProperty('font-synthesis'); }
    else {
      root.style.setProperty('--display', `"${s.display}", system-ui, sans-serif`);
      root.style.setProperty('--body', `"${s.body}", system-ui, sans-serif`);
      root.style.setProperty('--mono', `"${s.mono}", ui-monospace, monospace`);
      root.style.setProperty('font-synthesis', 'none'); // single-weight display fonts: no fake bold
    }
    title.textContent = `${i + 1}/${SETS.length} \u00b7 ${s.name}`; note.textContent = s.note;
    try { localStorage.setItem('fontlab', s.name); } catch {}
  };
  prev.onclick = () => { i = (i + SETS.length - 1) % SETS.length; apply(); };
  next.onclick = () => { i = (i + 1) % SETS.length; apply(); };
  const mount = () => { document.body.appendChild(ui); apply(); };
  document.body ? mount() : addEventListener('DOMContentLoaded', mount);
})();
