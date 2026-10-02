import * as THREE from 'three';
import { createStage } from './stage.ts';
import type { Part, FrameCtx } from './stage.ts';
import { buildTunnel } from './tunnel.ts';
import { buildHall } from './hall.ts';
import { buildRaveWedding } from './floors/rave-wedding.ts';
import { buildPrivateEvents } from './floors/private-events.ts';
import { buildPresents } from './floors/presents.ts';
import { FLOORS, SLUGS } from '../content/floors.ts';
import type { Slug } from '../content/floors.ts';
import { initialState, scrollBy, skip, step, enter, leave, swipeDir, cameraTarget } from './rig.ts';
import type { RigState, View } from './rig.ts';
import { slugFromPath, pathForSlug } from './route.ts';
import { setOpen, mountOnView } from './panels.ts';

declare global { interface Window { __xp: { setProgress(p: number): void; state(): RigState; sample(): boolean } } }

export async function start(root: HTMLElement): Promise<void> {
  await Promise.race([Promise.all([document.fonts.load('800 72px Unbounded'), document.fonts.load('500 30px "JetBrains Mono"')]), new Promise((r) => setTimeout(r, 1500))]);
  const canvas = root.querySelector<HTMLCanvasElement>('.xp-canvas')!;
  const html = document.documentElement;
  // Context lost → drop back to the static page.
  const stage = createStage(canvas, () => { html.classList.remove('xp-3d', 'xp-ready'); mountOnView(root); });
  html.classList.add('xp-3d'); // only now: a slow chunk download leaves the static page usable
  const builders = [buildRaveWedding, buildPrivateEvents, buildPresents];
  const floorParts = FLOORS.map((f, i) => builders[i](f, i));
  const parts: Part[] = [buildTunnel(), buildHall(), ...floorParts];
  parts.forEach((p) => stage.scene.add(p.object));

  const initialSlug = root.dataset.initial || null;
  let s: RigState = initialState(initialSlug ? SLUGS.indexOf(initialSlug as Slug) : null);
  const hallName = root.querySelector<HTMLElement>('.hall-name')!;
  const hallUi = root.querySelector<HTMLElement>('.hall-ui')!;

  // ---- which part of the viewport the UI covers (the camera frames the rest) ----
  const view: View = { aspect: 1, tanV: 1, right: 0, bottom: 0 };
  const measure = () => {
    const W = innerWidth || 1, H = innerHeight || 1;
    view.right = view.bottom = 0;
    if (s.mode === 'hall') view.bottom = Math.max(0, H - hallUi.getBoundingClientRect().top) / H;
    if (s.mode === 'floor' && s.active !== null) {
      const panel = root.querySelector<HTMLElement>(`.panel[data-slug="${SLUGS[s.active]}"]`)!;
      // offsetWidth/Height ignore the slide transform, so this is the settled size.
      if (panel.offsetWidth < W) view.right = panel.offsetWidth / W;
      else view.bottom = panel.offsetHeight / H;
    }
  };
  addEventListener('resize', () => measure());

  // ---- state → DOM ----
  const sync = () => {
    root.dataset.mode = s.mode;
    root.style.setProperty('--p', String(s.progress));
    hallName.textContent = FLOORS[s.focus].name;
    setOpen(root, s.active === null ? null : SLUGS[s.active]);
    measure();
  };
  const go = (next: RigState, push: boolean) => {
    const was = s.active;
    s = next;
    if (push && was !== s.active) history.pushState(null, '', pathForSlug(s.active === null ? null : SLUGS[s.active]));
    sync();
  };

  // ---- router ----
  addEventListener('popstate', () => {
    const slug = slugFromPath(location.pathname, SLUGS);
    go(slug ? enter(s, SLUGS.indexOf(slug as Slug)) : leave(skip(s)), false);
  });

  // ---- input (ignored when it starts inside an open panel) ----
  const inPanel = (e: Event) => !!(e.target as Element | null)?.closest?.('.panel');
  addEventListener('wheel', (e) => {
    if (inPanel(e)) return;
    if (s.mode === 'tunnel') go(scrollBy(s, e.deltaY, innerHeight), false);
    else if (s.mode === 'hall' && Math.abs(e.deltaX) > 30) go(step(s, e.deltaX > 0 ? 1 : -1), false);
  }, { passive: true });

  let t0: { x: number; y: number; time: number } | null = null;
  canvas.addEventListener('pointerdown', (e) => { t0 = { x: e.clientX, y: e.clientY, time: performance.now() }; });
  canvas.addEventListener('pointermove', (e) => {
    if (!t0 || s.mode !== 'tunnel') return;
    go(scrollBy(s, (t0.y - e.clientY) * 1.5, innerHeight), false);
    t0 = { ...t0, x: e.clientX, y: e.clientY };
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!t0) return;
    const dx = e.clientX - t0.x, dy = e.clientY - t0.y, quick = performance.now() - t0.time < 400;
    t0 = null;
    if (s.mode !== 'hall') return;
    const dir = swipeDir(dx, dy);
    if (dir) return go(step(s, dir), false);
    if (quick && Math.hypot(dx, dy) < 10) tapAt(e.clientX, e.clientY);
  });
  canvas.addEventListener('pointercancel', () => { t0 = null; });

  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function tapAt(x: number, y: number) {
    ndc.set((x / innerWidth) * 2 - 1, -(y / innerHeight) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(floorParts.map((p) => p.hit!), false)[0];
    if (hit) go(enter(s, floorParts.findIndex((p) => p.hit === hit.object)), true);
  }

  addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') go(step(s, -1), false);
    else if (e.key === 'ArrowRight') go(step(s, 1), false);
    else if (e.key === 'Enter' && s.mode === 'hall') go(enter(s), true);
    else if (e.key === 'Escape' && s.mode === 'floor') go(leave(s), true);
    else if ((e.key === 'ArrowDown' || e.key === ' ') && s.mode === 'tunnel') go(scrollBy(s, innerHeight / 2, innerHeight), false);
  });

  root.querySelector('.skip')!.addEventListener('click', (e) => { e.preventDefault(); go(skip(s), false); });
  root.querySelector('.hall-prev')!.addEventListener('click', () => go(step(s, -1), false));
  root.querySelector('.hall-next')!.addEventListener('click', () => go(step(s, 1), false));
  root.querySelector('.hall-enter')!.addEventListener('click', () => go(enter(s), true));
  root.querySelectorAll('.panel-back').forEach((b) => b.addEventListener('click', () => go(leave(s), true)));

  window.__xp = {
    setProgress: (p) => go(scrollBy({ ...s, mode: 'tunnel', progress: 0, active: null }, p * 3 * innerHeight, innerHeight), false),
    state: () => s,
    sample: () => stage.sample(),
  };

  // ---- frame loop ----
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3();
  const target = () => {
    view.aspect = (innerWidth || 1) / (innerHeight || 1);
    view.tanV = Math.tan((stage.camera.fov * Math.PI) / 360);
    return cameraTarget(s, view);
  };
  measure();
  const snap = target(); // deep links start in place, no fly-in
  stage.camera.position.set(...snap.pos); lookNow.set(...snap.look); stage.camera.lookAt(lookNow);
  let first = true;
  stage.start((t, dt) => {
    const tgt = target();
    pos.set(...tgt.pos); look.set(...tgt.look);
    const k = 1 - Math.exp(-dt * (s.mode === 'tunnel' ? 6 : 2.5));
    stage.camera.position.lerp(pos, k); lookNow.lerp(look, k); stage.camera.lookAt(lookNow);
    const ctx: FrameCtx = { t, dt, progress: s.progress, focus: s.focus, active: s.active === null ? null : SLUGS[s.active], low: stage.low };
    parts.forEach((p) => p.update(ctx));
    if (first) { first = false; requestAnimationFrame(() => html.classList.add('xp-ready')); }
  });
  sync();
}
