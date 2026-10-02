import * as THREE from 'three';
import type { Slug } from '../content/floors.ts';

export interface FrameCtx { t: number; dt: number; progress: number; focus: number; active: Slug | null; low: boolean }
export interface Part { object: THREE.Object3D; update(ctx: FrameCtx): void; hit?: THREE.Object3D; slug?: Slug }
export interface Stage {
  scene: THREE.Scene; camera: THREE.PerspectiveCamera; renderer: THREE.WebGLRenderer; low: boolean;
  start(frame: (t: number, dt: number) => void): void;
  sample(): boolean;
}

export function createStage(canvas: HTMLCanvasElement): Stage {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x0a0a10);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0a10, 0.018);
  const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 400);

  const resize = () => {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w < h ? 80 : 62; // wider on portrait phones
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(canvas);
  resize();

  const stage: Stage = {
    scene, camera, renderer, low: false,
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
      const run = () => renderer.setAnimationLoop(document.hidden ? null : loop);
      document.addEventListener('visibilitychange', () => { clock.getDelta(); run(); });
      run();
    },
    /** True when the frame is not one flat color (blank-canvas check for screenshots). */
    sample() {
      renderer.render(scene, camera);
      const gl = renderer.getContext();
      const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
      const seen = new Set<string>();
      for (const [fx, fy] of [[.5, .5], [.25, .3], [.75, .7], [.5, .15], [.5, .85], [.1, .5], [.9, .5]]) {
        gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        seen.add(px.join(','));
      }
      return seen.size > 1;
    },
  };
  return stage;
}
