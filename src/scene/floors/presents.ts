import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import type { Part, FrameCtx } from '../stage.ts';
import { buildFloorBase } from './base.ts';
import { makeLabel } from '../label.ts';
import { eventLabel } from '../../lib/links.ts';

const PINK = new THREE.Color('#FF2BD6'), CYAN = new THREE.Color('#00E5FF'), OFF = new THREE.Color('#13131C');

export function buildPresents(floor: Floor, index: number): Part {
  const { group, hit, pulseOf } = buildFloorBase(floor, index);

  // Light-up grid on the back wall: 12×6 tiles.
  const COLS = 12, ROWS = 6, tiles = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.85, 0.85), new THREE.MeshBasicMaterial({ toneMapped: false }), COLS * ROWS);
  const m = new THREE.Matrix4();
  for (let i = 0; i < COLS * ROWS; i++) {
    m.makeTranslation((i % COLS) - COLS / 2 + 0.5, Math.floor(i / COLS) + 0.8, -5);
    tiles.setMatrixAt(i, m); tiles.setColorAt(i, OFF);
  }
  group.add(tiles);

  // Crowd: dark capsules in front, bobbing on the beat.
  const CROWD = 40, crowd = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.28, 0.9, 4, 8), new THREE.MeshBasicMaterial({ color: 0x050508 }), CROWD);
  const spots = Array.from({ length: CROWD }, () => [(Math.random() - 0.5) * 10, (Math.random() - 0.5) * 7 + 1, Math.random() * Math.PI * 2]);
  group.add(crowd);

  const sign = makeLabel(eventLabel(floor.presents?.event ?? null), '#00E5FF');
  sign.position.set(0, 7.2, -5); sign.scale.multiplyScalar(0.4);
  group.add(sign);

  let lastBeat = -1;
  return {
    object: group, hit, slug: floor.slug,
    update(ctx: FrameCtx) {
      const p = pulseOf(ctx.t);
      const beat = Math.floor((ctx.t * floor.bpm) / 60);
      if (beat !== lastBeat) {
        lastBeat = beat;
        for (let i = 0; i < COLS * ROWS; i++) {
          const on = (i * 7 + beat * 3) % 5 === 0;
          tiles.setColorAt(i, on ? ((i + beat) % 2 ? PINK : CYAN) : OFF);
        }
        tiles.instanceColor!.needsUpdate = true;
      }
      const n = ctx.low ? CROWD / 2 : CROWD;
      for (let i = 0; i < n; i++) {
        const [x, z, ph] = spots[i];
        m.makeTranslation(x, 0.3 + p * 0.35 * (0.6 + 0.4 * Math.sin(ph)), z);
        crowd.setMatrixAt(i, m);
      }
      crowd.count = n;
      crowd.instanceMatrix.needsUpdate = true;
    },
  };
}
