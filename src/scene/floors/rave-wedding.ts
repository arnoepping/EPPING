import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import type { Part, FrameCtx } from '../stage.ts';
import { buildFloorBase } from './base.ts';

export function buildRaveWedding(floor: Floor, index: number): Part {
  const { group, hit, pulseOf, gate } = buildFloorBase(floor, index);

  // Mirrorball: flat-shaded facets lit by two orbiting colored lights.
  const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4, 2), new THREE.MeshPhongMaterial({ color: 0x9a9aa8, specular: 0xffffff, shininess: 120, flatShading: true }));
  ball.position.y = 7.5;
  const l1 = new THREE.PointLight(0xff2bd6, 60, 20), l2 = new THREE.PointLight(0x00e5ff, 40, 20);
  group.add(ball, l1, l2, new THREE.AmbientLight(0xffffff, 0.15));

  // Lasers: thin additive beams fanning down from the ball.
  const lasers = new THREE.Group();
  const laserMat = new THREE.MeshBasicMaterial({ color: 0xff2bd6, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false });
  for (let i = 0; i < 8; i++) {
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 14, 4), laserMat);
    beam.geometry.translate(0, -7, 0);
    beam.rotation.set(0.5, (i / 8) * Math.PI * 2, 0, 'YXZ');
    lasers.add(beam);
  }
  lasers.position.y = 7.5;
  group.add(lasers);

  // Confetti.
  const N = 500, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), palette = ['#FF2BD6', '#00E5FF', '#EDEDF3'].map((c) => new THREE.Color(c));
  for (let i = 0; i < N; i++) {
    pos.set([(Math.random() - 0.5) * 12, Math.random() * 10, (Math.random() - 0.5) * 12], i * 3);
    const c = palette[i % 3]; col.set([c.r, c.g, c.b], i * 3);
  }
  const cg = new THREE.BufferGeometry();
  cg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  cg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const confetti = new THREE.Points(cg, new THREE.PointsMaterial({ size: 0.12, vertexColors: true }));
  group.add(confetti);

  return {
    object: group, hit, slug: floor.slug,
    update(ctx: FrameCtx) {
      if (!gate(ctx)) return;
      const p = pulseOf(ctx.t);
      ball.rotation.y = ctx.t * 0.6;
      l1.position.set(Math.cos(ctx.t) * 4, 9, Math.sin(ctx.t) * 4);
      l2.position.set(Math.cos(ctx.t + Math.PI) * 4, 6, Math.sin(ctx.t + Math.PI) * 4);
      lasers.rotation.y = ctx.t * 0.8;
      lasers.children.forEach((b, i) => { b.rotation.x = 0.35 + 0.25 * Math.sin(ctx.t * 1.3 + i); });
      laserMat.opacity = 0.25 + 0.6 * p;
      const n = ctx.low ? N / 2 : N;
      for (let i = 0; i < n; i++) {
        let y = pos[i * 3 + 1] - ctx.dt * (0.6 + (i % 7) * 0.08);
        if (y < -0.4) y = 10;
        pos[i * 3 + 1] = y;
      }
      cg.attributes.position.needsUpdate = true;
      cg.setDrawRange(0, ctx.low ? N / 2 : N);
    },
  };
}
