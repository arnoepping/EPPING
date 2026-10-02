import * as THREE from 'three';
import type { Part, FrameCtx } from './stage.ts';
import { TUNNEL_LEN } from './layout.ts';

const PINK = new THREE.Color('#FF2BD6'), CYAN = new THREE.Color('#00E5FF');

export function buildTunnel(): Part {
  const group = new THREE.Group();
  const count = Math.floor(TUNNEL_LEN / 2) + 1; // rings from z=6 to z=-114; the mouth opens into the hall
  const ringGeo = new THREE.TorusGeometry(4, 0.05, 6, 64);
  const glowGeo = new THREE.TorusGeometry(4, 0.22, 6, 64);
  const core = new THREE.InstancedMesh(ringGeo, new THREE.MeshBasicMaterial({ toneMapped: false }), count);
  const glow = new THREE.InstancedMesh(glowGeo, new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), count);
  const m = new THREE.Matrix4();
  for (let i = 0; i < count; i++) {
    m.makeTranslation(0, 0, -i * 2 + 6);
    core.setMatrixAt(i, m); glow.setMatrixAt(i, m);
    const c = i % 2 ? CYAN : PINK;
    core.setColorAt(i, c); glow.setColorAt(i, c);
  }
  group.add(core, glow);

  // Speed lines: thin streaks along the walls.
  const LINES = 360, pos = new Float32Array(LINES * 6), col = new Float32Array(LINES * 6);
  for (let i = 0; i < LINES; i++) {
    const a = Math.random() * Math.PI * 2, r = 3.2 + Math.random() * 0.6, z = -Math.random() * (TUNNEL_LEN - 10), len = 1 + Math.random() * 3;
    const x = Math.cos(a) * r, y = Math.sin(a) * r, c = Math.random() > 0.5 ? PINK : CYAN;
    pos.set([x, y, z, x, y, z - len], i * 6);
    col.set([c.r, c.g, c.b, c.r, c.g, c.b], i * 6);
  }
  const lg = new THREE.BufferGeometry();
  lg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const lines = new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending }));
  group.add(lines);

  return {
    object: group,
    update(ctx: FrameCtx) {
      group.visible = ctx.progress < 1 || ctx.active === null; // keep visible for the hall entrance view
      group.rotation.z = ctx.t * 0.15 + ctx.progress * 2;
      (glow.material as THREE.MeshBasicMaterial).opacity = 0.12 + 0.12 * Math.sin(ctx.t * 4);
      lg.setDrawRange(0, ctx.low ? LINES : LINES * 2);
    },
  };
}
