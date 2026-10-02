import * as THREE from 'three';
import { createStage } from './stage.ts';
import type { Part } from './stage.ts';
import { buildTunnel } from './tunnel.ts';
import { buildHall } from './hall.ts';
import { buildRaveWedding } from './floors/rave-wedding.ts';
import { buildPrivateEvents } from './floors/private-events.ts';
import { buildPresents } from './floors/presents.ts';
import { FLOORS } from '../content/floors.ts';
import { initialState, scrollBy, cameraTarget } from './rig.ts';
import type { RigState } from './rig.ts';

declare global { interface Window { __xp: { setProgress(p: number): void; state(): RigState; sample(): boolean } } }

export async function start(root: HTMLElement): Promise<void> {
  await Promise.race([Promise.all([document.fonts.load('800 72px Unbounded'), document.fonts.load('500 30px "JetBrains Mono"')]), new Promise((r) => setTimeout(r, 1500))]);
  const canvas = root.querySelector<HTMLCanvasElement>('.xp-canvas')!;
  const stage = createStage(canvas);
  const builders = [buildRaveWedding, buildPrivateEvents, buildPresents];
  const floorParts = FLOORS.map((f, i) => builders[i](f, i));
  const parts: Part[] = [buildTunnel(), buildHall(), ...floorParts];
  parts.forEach((p) => stage.scene.add(p.object));

  let s: RigState = initialState(null);
  const pos = new THREE.Vector3(), look = new THREE.Vector3(), lookNow = new THREE.Vector3(0, 0, -10);
  const sync = () => { root.dataset.mode = s.mode; root.style.setProperty('--p', String(s.progress)); };

  addEventListener('wheel', (e) => { s = scrollBy(s, e.deltaY, innerHeight); sync(); }, { passive: true });

  window.__xp = {
    setProgress: (p) => { s = scrollBy({ ...s, mode: 'tunnel', progress: 0 }, p * 3 * innerHeight, innerHeight); sync(); },
    state: () => s,
    sample: () => stage.sample(),
  };

  let first = true;
  stage.start((t, dt) => {
    const tgt = cameraTarget(s);
    pos.set(...tgt.pos); look.set(...tgt.look);
    const k = 1 - Math.exp(-dt * 4);
    stage.camera.position.lerp(pos, k); lookNow.lerp(look, k); stage.camera.lookAt(lookNow);
    const ctx = { t, dt, progress: s.progress, focus: s.focus, active: null, low: stage.low };
    parts.forEach((p) => p.update(ctx));
    if (first) { first = false; requestAnimationFrame(() => document.documentElement.classList.add('xp-ready')); }
  });
  sync();
}
