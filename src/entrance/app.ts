import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { buildWorld } from './world.ts';
import { Sound } from './sound.ts';
import { openLightbox } from '../lib/lightbox.ts';
import { track } from '../lib/track.ts';

// Scroll covers [0, AUTO_FROM]: the street and the stairs. Stepping onto the roof locks the page and the rest plays by itself.
const STAGES = [0, 0.3, 0.72, 1], AUTO_FROM = STAGES[2], AUTO_DUR = 9;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => t * t * (3 - 2 * t);

export function start(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.ent-canvas')!;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const html = document.documentElement;

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15;
  const world = buildWorld();
  const camera = new THREE.PerspectiveCamera(60, 1, 0.05, 700);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(world.scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.6, 0.45, 0.88);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false); composer.setSize(w, h);
    bloom.resolution.set(w / 2, h / 2);
    camera.aspect = w / h; camera.fov = w < h ? 74 : 58; camera.updateProjectionMatrix();
  };
  // show the 3D stage only once the street model is in (until then the static page stays)
  world.ready.then(() => { world.reflect(renderer); html.classList.add('ent-3d'); resize(); }).catch((e) => console.error('street model failed', e));
  new ResizeObserver(resize).observe(canvas);
  resize();

  // ---------- scroll, roof lock, door clicks ----------
  let p = 0, autoStart: number | null = null, anim: { from: number; to: number; t0: number; dur: number } | null = null;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const maxScroll = () => document.documentElement.scrollHeight - innerHeight;
  const lock = (on: boolean) => { html.classList.toggle('ent-locked', on); };
  const goTo = (toP: number) => { anim = { from: scrollY, to: clamp(toP / AUTO_FROM) * maxScroll(), t0: performance.now(), dur: 1000 + Math.abs(toP - p) * 6000 }; };
  const block = (e: Event) => { if (autoStart !== null && !(e.target as Element).closest?.('.floor-page')) e.preventDefault(); };
  addEventListener('wheel', block, { passive: false }); addEventListener('touchmove', block, { passive: false });
  for (const ev of ['wheel', 'touchstart', 'keydown']) addEventListener(ev, () => { anim = null; }, { passive: true });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const doorUnder = (e: MouseEvent) => {
    if (autoStart !== null) return null;
    ndc.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (p < 0.33 && ray.intersectObject(world.streetDoor).length) return 0.36;
    if (p > 0.3 && p < 0.66 && ray.intersectObject(world.roofDoor).length) return AUTO_FROM;
    return null;
  };
  canvas.addEventListener('click', (e) => { const to = doorUnder(e); if (to !== null) { track('entrance-door', { door: to === AUTO_FROM ? 'top' : 'street' }); goTo(to); } });
  canvas.addEventListener('mousemove', (e) => { canvas.style.cursor = doorUnder(e) !== null ? 'pointer' : ''; });

  // ---------- sound + HUD ----------
  const sound = new Sound('media/ade-house-mix.mp3', 18 * 60 + 30); // Epping – ADE House Mix, from 18:30
  const snd = $<HTMLButtonElement>('[data-sound]');
  snd.addEventListener('click', async () => { const on = await sound.toggle(); if (on) track('sound-on'); snd.setAttribute('aria-pressed', String(on)); });
  const skip = $<HTMLButtonElement>('[data-skip]');
  skip.addEventListener('click', () => { track('skip'); p = AUTO_FROM; scrollTo(0, maxScroll()); });
  const hint = $('.ent-hint');

  // ---------- finale + floor pages ----------
  const fin = $('.finale'), vid = fin.querySelector('video')!, fp = $<HTMLElement>('.floor-page');
  $('[data-again]').addEventListener('click', () => { track('replay'); autoStart = null; lock(false); p = 0; scrollTo(0, 0); });
  function openFloor(slug: string, push = true) {
    const tpl = root.querySelector<HTMLTemplateElement>(`template[data-floor-tpl="${slug}"]`);
    if (!tpl) return;
    track('floor-open', { floor: slug });
    fp.innerHTML = tpl.innerHTML; fp.hidden = false; fp.scrollTop = 0;
    root.classList.add('reading'); vid.pause();
    // pin gallery URLs before pushState moves the base to /<slug>/
    fp.querySelectorAll('img').forEach((i) => (i.src = i.src));
    fp.querySelectorAll<HTMLElement>('[data-gallery]').forEach((g) => (g.dataset.base = location.href));
    if (push) history.pushState({ floor: slug }, '', `/${slug}/`);
    fp.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }
  function closeFloor(push = true) {
    if (fp.hidden) return;
    fp.hidden = true; fp.innerHTML = ''; root.classList.remove('reading'); vid.play().catch(() => {});
    if (push) history.pushState({}, '', '/');
  }
  root.addEventListener('click', (e) => {
    const t = e.target as Element, fl = t.closest<HTMLElement>('[data-floor]'), back = t.closest('[data-back]'), cp = t.closest<HTMLElement>('[data-copy]');
    if (fl) { e.preventDefault(); openFloor(fl.dataset.floor!); }
    if (back) { e.preventDefault(); closeFloor(); }
    const lb = t.closest<HTMLElement>('[data-lb]');
    if (lb) openLightbox(lb, () => { if (sound.on) snd.click(); }); // a clip with sound: stop the mix first
    if (cp) { track('contact', { type: 'copy-email', floor: cp.dataset.floorSlug ?? '' }); navigator.clipboard.writeText(cp.dataset.copy!).then(() => (cp.textContent = 'Copied'), () => {}); }
  });
  addEventListener('popstate', () => closeFloor(false));
  addEventListener('keydown', (e) => { if (e.key === 'Escape') closeFloor(); });

  // ---------- loop ----------
  const STAGE_NAMES = ['street', 'stairs', 'roof'], seen = new Set<number>();
  const look = new THREE.Vector3(), clock = new THREE.Clock();
  renderer.setAnimationLoop(() => {
    const t = clock.getElapsedTime(), ms = performance.now();
    if (anim) {
      const k = clamp((ms - anim.t0) / anim.dur), e2 = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
      scrollTo(0, anim.from + (anim.to - anim.from) * e2);
      if (k >= 1) anim = null;
    }
    if (autoStart === null) {
      const target = (maxScroll() > 0 ? clamp(scrollY / maxScroll()) : 0) * AUTO_FROM;
      p = reduce ? target : p + (target - p) * 0.1;
      if (p >= AUTO_FROM - 0.003) { autoStart = ms; lock(true); }
    }
    if (autoStart !== null) p = AUTO_FROM + (1 - AUTO_FROM) * clamp((ms - autoStart) / 1000 / AUTO_DUR);
    const stage = p < STAGES[1] ? 0 : p < STAGES[2] ? 1 : 2, local = clamp((p - STAGES[stage]) / (STAGES[stage + 1] - STAGES[stage]));
    if (!seen.has(stage)) { seen.add(stage); track('entrance-stage', { stage: STAGE_NAMES[stage] }); }

    const kick = reduce ? 0 : sound.kick(t);
    // the street door swings open just before you reach it, so you walk past an open door
    world.setDoors(stage === 0 ? ease(clamp((local - 0.8) / 0.2)) : 1, stage === 2 ? 1 : stage === 1 ? ease(clamp((local - 0.9) / 0.1)) : 0);
    const c = world.cameraAt(stage, local, t);
    camera.position.lerp(c.pos, reduce ? 1 : 0.35); look.lerp(c.look, reduce ? 1 : 0.35);
    if (camera.position.distanceTo(c.pos) > 3) { camera.position.copy(c.pos); look.copy(c.look); }
    camera.lookAt(look);
    world.update(t, kick, camera);
    sound.update(stage, local);

    hint.style.opacity = p < 0.02 ? '' : '0';
    skip.hidden = autoStart !== null;
    const f = clamp((p - 0.885) / 0.06); // roof: once the camera stands at the booth
    fin.style.opacity = String(f); fin.classList.toggle('on', f > 0.6);
    if (f > 0 && vid.paused && fp.hidden) { vid.preload = 'auto'; vid.play().catch(() => {}); }
    if (f === 0 && !vid.paused) vid.pause();
    composer.render();
  });
}
