import * as THREE from 'three';
import type { Slug } from '../content/floors.ts';

export interface FrameCtx { t: number; dt: number; progress: number; focus: number; active: Slug | null; low: boolean }
export interface Part { object: THREE.Object3D; update(ctx: FrameCtx): void; hit?: THREE.Object3D; slug?: Slug }
export interface Stage {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; low: boolean;
  start(frame: (t: number, dt: number) => void): void;
  /** Re-read the canvas size (e.g. right after it becomes visible). */
  resize(): void;
}

/** `onLost` runs when the WebGL context is lost; the loop is already stopped. */
export function createStage(canvas: HTMLCanvasElement, onLost?: () => void): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a10);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a10, 0.018);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (!w || !h) return; // hidden canvas (e.g. before xp-3d): wait for the observer
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 80 : 62; // wider on portrait phones
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  let lost = false;
  canvas.addEventListener('webglcontextlost', () => {
    lost = true;
    renderer.setAnimationLoop(null);
    onLost?.();
  });

  const stage: Stage = {
    scene, camera, renderer, low: false, resize,
    start(frame) {
      const clock = new THREE.Clock();
      let slow = 0;
      const loop = () => {
        const dt = Math.min(clock.getDelta(), 0.1);
        // Adaptive quality: >20ms frames for 2s → low mode, permanently.
        slow = dt > 0.02 ? slow + dt : 0;
        if (!stage.low && slow > 2) { stage.low = true; renderer.setPixelRatio(1); resize(); }
        frame(clock.elapsedTime, dt);
        renderer.render(scene, camera);
      };
      const run = () => renderer.setAnimationLoop(document.hidden || lost ? null : loop);
      document.addEventListener('visibilitychange', () => { clock.getDelta(); run(); });
      run();
    },
  };
  return stage;
}
