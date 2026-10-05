// Full-screen viewer for floor-page galleries: arrows/swipe/keys, counter, videos play with sound while shown.
// One <dialog> per page, built on first use. onSound fires when a clip starts with sound (the entrance stops its mix).
import type { GalleryItem } from '../content/floors.ts';
let dlg: HTMLDialogElement, stage: HTMLElement, count: HTMLElement, cap: HTMLElement;
let items: GalleryItem[] = [], at = 0, onSound = () => {};
const pad = (n: number) => String(n).padStart(2, '0');

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'lb';
  dlg.innerHTML = `<div class="lb-top"><span class="lb-n"></span><button type="button" class="lb-x" aria-label="Close">✕</button></div>
    <div class="lb-stage"></div>
    <div class="lb-bot"><button type="button" class="lb-prev" aria-label="Previous">←</button><p class="lb-cap"></p><button type="button" class="lb-next" aria-label="Next">→</button></div>`;
  document.body.appendChild(dlg);
  stage = dlg.querySelector('.lb-stage')!; count = dlg.querySelector('.lb-n')!; cap = dlg.querySelector('.lb-cap')!;
  dlg.querySelector('.lb-x')!.addEventListener('click', () => dlg.close());
  dlg.querySelector('.lb-prev')!.addEventListener('click', () => go(-1));
  dlg.querySelector('.lb-next')!.addEventListener('click', () => go(1));
  dlg.addEventListener('close', () => { stage.innerHTML = ''; document.documentElement.classList.remove('lb-open'); });
  dlg.addEventListener('click', (e) => { if (e.target === stage) dlg.close(); }); // tap beside the media closes
  dlg.addEventListener('keydown', (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); });
  let x0 = 0, y0 = 0;
  stage.addEventListener('pointerdown', (e) => { x0 = e.clientX; y0 = e.clientY; });
  stage.addEventListener('pointerup', (e) => { const dx = e.clientX - x0; if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(e.clientY - y0)) go(dx < 0 ? 1 : -1); });
}

function show(dir = 0) {
  const it = items[at];
  stage.innerHTML = '';
  const el = it.kind === 'video' ? Object.assign(document.createElement('video'), { src: it.src, poster: it.poster ?? '', controls: true, playsInline: true, autoplay: true, loop: true })
    : Object.assign(document.createElement('img'), { src: it.src, alt: it.caption });
  el.className = 'lb-media';
  if (dir) el.dataset.dir = dir > 0 ? 'next' : 'prev';
  stage.appendChild(el);
  if (el instanceof HTMLVideoElement) { onSound(); el.play().catch(() => {}); }
  count.textContent = `${pad(at + 1)} / ${pad(items.length)}`;
  cap.textContent = it.caption;
  // warm the next item so swiping feels instant
  const nx = items[(at + 1) % items.length]; new Image().src = nx.poster ?? nx.src;
}
function go(d: number) { at = (at + d + items.length) % items.length; show(d); }

export function openLightbox(trigger: HTMLElement, soundHook?: () => void) {
  const g = trigger.closest<HTMLElement>('[data-gallery]');
  if (!g?.dataset.items) return;
  if (!dlg) build();
  // data-base: set by the entrance overlay before pushState moves the page to /<slug>/
  const base = g.dataset.base ?? g.baseURI, abs = (p?: string) => p && new URL(p, base).href;
  items = (JSON.parse(g.dataset.items) as GalleryItem[]).map((it) => ({ ...it, src: abs(it.src)!, poster: abs(it.poster) }));
  at = Number(trigger.dataset.lb) || 0;
  onSound = soundHook ?? (() => {});
  document.documentElement.classList.add('lb-open');
  dlg.showModal();
  show();
}
