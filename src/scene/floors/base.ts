import * as THREE from 'three';
import type { Floor } from '../../content/floors.ts';
import { FLOOR_X, HALL_Z } from '../layout.ts';
import { pulse } from '../beat.ts';
import { makeLabel } from '../label.ts';

export function buildFloorBase(floor: Floor, index: number) {
  const group = new THREE.Group();
  group.position.set(FLOOR_X[index], 0, HALL_Z);
  const color = new THREE.Color(floor.color);

  const platform = new THREE.Mesh(new THREE.CylinderGeometry(6, 6.4, 0.6, 48), new THREE.MeshBasicMaterial({ color: 0x13131c }));
  platform.position.y = -0.7;
  const ring = new THREE.Mesh(new THREE.TorusGeometry(6.2, 0.06, 6, 96), new THREE.MeshBasicMaterial({ color, toneMapped: false }));
  ring.rotation.x = -Math.PI / 2; ring.position.y = -0.38;
  const beam = new THREE.Mesh(
    new THREE.ConeGeometry(6, 13, 32, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.07, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }),
  );
  beam.position.y = 5.8;
  const label = makeLabel(floor.name.toUpperCase(), floor.color, floor.tagline);
  label.position.set(0, 9, 0);
  label.scale.multiplyScalar(0.55);
  const hit = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 12), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.y = 5;
  group.add(platform, ring, beam, label, hit);

  const ringMat = ring.material as THREE.MeshBasicMaterial, beamMat = beam.material as THREE.MeshBasicMaterial;
  const pulseOf = (t: number) => {
    const p = pulse(t, floor.bpm);
    ringMat.color.copy(color).multiplyScalar(0.6 + 0.8 * p);
    beamMat.opacity = 0.04 + 0.06 * p;
    return p;
  };
  return { group, hit, pulseOf };
}
