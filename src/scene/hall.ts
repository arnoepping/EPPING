import * as THREE from 'three';
import type { Part, FrameCtx } from './stage.ts';
import { HALL_Z } from './layout.ts';

export function buildHall(): Part {
  const g = new THREE.Group();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 80), new THREE.MeshBasicMaterial({ color: 0x13131c }));
  floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1, HALL_Z + 10);
  const grid = new THREE.GridHelper(90, 45, 0x262634, 0x1a1a26);
  grid.position.set(0, -0.99, HALL_Z + 10);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 30), new THREE.MeshBasicMaterial({ color: 0x0d0d15 }));
  wall.position.set(0, 14, HALL_Z - 12);
  // Truss: three horizontal bars above the floors.
  const barMat = new THREE.MeshBasicMaterial({ color: 0x262634 });
  for (const z of [HALL_Z - 6, HALL_Z, HALL_Z + 6]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(70, 0.3, 0.3), barMat);
    bar.position.set(0, 12, z); g.add(bar);
  }
  // Fog haze: big soft additive planes.
  const hazeMat = new THREE.MeshBasicMaterial({ color: 0x1a1030, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false });
  const haze = new THREE.Mesh(new THREE.PlaneGeometry(120, 20), hazeMat);
  haze.position.set(0, 3, HALL_Z - 4);
  g.add(floor, grid, wall, haze);
  return {
    object: g,
    update(ctx: FrameCtx) {
      g.visible = ctx.progress > 0.6;
      hazeMat.opacity = 0.25 + 0.1 * Math.sin(ctx.t * 0.7);
    },
  };
}
