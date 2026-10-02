import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import type { Part, FrameCtx } from '../stage.ts';
import { buildFloorBase } from './base.ts';

const WALL_FRAG = `
  uniform float uTime; uniform float uPulse; varying vec2 vUv;
  void main(){
    vec2 g = vUv * vec2(64.0, 24.0);
    vec2 cell = fract(g) - 0.5;
    float dotMask = smoothstep(0.42, 0.3, length(cell));
    float wave = 0.5 + 0.5 * sin(floor(g.x) * 0.35 - uTime * 3.0 + sin(floor(g.y) * 0.5 + uTime));
    vec3 cyan = vec3(0.0, 0.898, 1.0);
    vec3 col = cyan * (0.15 + 0.85 * wave) * (0.5 + 0.7 * uPulse);
    gl_FragColor = vec4(col * dotMask, 1.0);
  }`;
const WALL_VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

function smokeTexture(): THREE.Texture {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!, r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,255,255,0.5)'); r.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

export function buildPrivateEvents(floor: Floor, index: number): Part {
  const { group, hit, pulseOf, gate } = buildFloorBase(floor, index);

  const uniforms = { uTime: { value: 0 }, uPulse: { value: 0 } };
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(11, 4.2), new THREE.ShaderMaterial({ uniforms, vertexShader: WALL_VERT, fragmentShader: WALL_FRAG }));
  wall.position.set(0, 3, -4.5);
  group.add(wall);

  const strobeMat = new THREE.MeshBasicMaterial({ color: 0x9ff6ff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false });
  for (const x of [-4.5, -1.5, 1.5, 4.5]) {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.35), strobeMat);
    s.position.set(x, 7.1, -3); group.add(s); // between LED wall (top 5.1) and label (bottom ~8.1)
  }

  const tex = smokeTexture();
  const smoke = Array.from({ length: 18 }, (_, i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: 0x00e5ff, transparent: true, opacity: 0.16, depthWrite: false }));
    sp.position.set((Math.random() - 0.5) * 11, Math.random() * 2, (Math.random() - 0.5) * 8);
    sp.scale.setScalar(4 + Math.random() * 3); sp.userData.v = 0.2 + (i % 5) * 0.05;
    group.add(sp); return sp;
  });

  return {
    object: group, hit, slug: floor.slug,
    update(ctx: FrameCtx) {
      if (!gate(ctx)) return;
      const p = pulseOf(ctx.t);
      uniforms.uTime.value = ctx.t; uniforms.uPulse.value = p;
      strobeMat.opacity = p > 0.9 && Math.floor((ctx.t * floor.bpm) / 60) % 2 === 0 ? 1 : 0; // flash on alternating beats
      smoke.forEach((sp, i) => {
        if (ctx.low && i % 2) { sp.visible = false; return; }
        sp.visible = true;
        sp.position.x += Math.sin(ctx.t * 0.3 + i) * ctx.dt * sp.userData.v;
        sp.position.y = 0.5 + Math.sin(ctx.t * 0.2 + i) * 0.8;
      });
    },
  };
}
