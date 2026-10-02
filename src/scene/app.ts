import * as THREE from 'three';
import { createStage } from './stage.ts';
import type { Part } from './stage.ts';
import { buildTunnel } from './tunnel.ts';
import { HALL_Z, FLOOR_X } from './layout.ts';
import { initialState, scrollBy, cameraTarget } from './rig.ts';
import type { RigState } from './rig.ts';

declare global { interface Window { __xp: { setProgress(p: number): void; state(): RigState; sample(): boolean } } }

export function start(root: HTMLElement): void {
  const canvas = root.querySelector<HTMLCanvasElement>('.xp-canvas')!;
  const stage = createStage(canvas);
  const parts: Part[] = [buildTunnel()];
  parts.forEach((p) => stage.scene.add(p.object));
  // TEMPORARY (Task 6 replaces with the real hall): one neon disc per floor so hall/floor views are not blank.
  for (const x of FLOOR_X) {
    const r = new THREE.Mesh(new THREE.CircleGeometry(5, 48), new THREE.MeshBasicMaterial({ color: '#FF2BD6', toneMapped: false }));
    r.position.set(x, 2, HALL_Z); stage.scene.add(r);
  }

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
