import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import wordmark from '../components/wordmark.json';
import { POSTERS } from '../content/posters.ts';
import { PAL } from './palette.ts';
import { brick, puff } from './textures.ts';

// One continuous world (metres, y up). The street is at z > 0, the facade at z = 0 with the door,
// the stairwell climbs toward -z inside the building, and the roof starts behind the top door.
export const N = 36, RISE = 0.24, RUN = 0.26, W = 1.5, Z0 = -1.0; // steep flight, ~43°
export const TOP_Y = N * RISE, TOP_Z = Z0 - N * RUN, ROOF_Z = TOP_Z - 1.6, CEIL = 3.0;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => t * t * (3 - 2 * t);
/** Height of the stair surface under z. */
export const stairY = (z: number) => clamp((Z0 - z) / RUN, 0, N) * RISE;

const C = (hex: string) => new THREE.Color(hex);
const V = (x: number, y: number) => new THREE.Vector2(x, y);
const glowMat = (c: THREE.Color) => new THREE.MeshBasicMaterial({ color: c, toneMapped: false, side: THREE.DoubleSide });
/** Neon colour along the climb: pink at the bottom, orange at the top. */
const climbColor = (z: number) => C(PAL.b).lerp(C(PAL.a), clamp((Z0 - z) / (Z0 - ROOF_Z)));

function quad(p: THREE.Vector3[], colors?: THREE.Color[]): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p.flatMap((v) => [v.x, v.y, v.z]), 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
  if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors.flatMap((c) => [c.r, c.g, c.b]), 3));
  g.setIndex([0, 1, 2, 0, 2, 3]);
  g.computeVertexNormals();
  return g;
}

/** A thin glowing tube between two points. */
function tube(a: THREE.Vector3, b: THREE.Vector3, r: number, mat: THREE.Material): THREE.Mesh {
  const len = a.distanceTo(b), m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8, 1, true), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

function brickMat(base: { map: THREE.Texture; bump: THREE.Texture }, w: number, h: number): THREE.MeshStandardMaterial {
  const map = base.map.clone(), bump = base.bump.clone();
  for (const t of [map, bump]) { t.repeat.set(w / 2, h / 2); t.needsUpdate = true; }
  return new THREE.MeshStandardMaterial({ map, bumpMap: bump, bumpScale: 3, roughness: 0.95 });
}

function wordmarkGeometry(width: number): THREE.ShapeGeometry {
  const svg = new SVGLoader().parse(`<svg xmlns="http://www.w3.org/2000/svg"><path d="${wordmark.d}"/></svg>`);
  const g = new THREE.ShapeGeometry(svg.paths.flatMap((p) => SVGLoader.createShapes(p)), 6);
  g.computeBoundingBox();
  const bb = g.boundingBox!, s = width / (bb.max.x - bb.min.x);
  g.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, 0);
  g.scale(s, -s, 1); // SVG y points down
  return g;
}

export interface World {
  scene: THREE.Scene;
  /** resolves once the baked street model is in the scene */
  ready: Promise<void>;
  streetDoor: THREE.Object3D; roofDoor: THREE.Object3D;
  setDoors(street: number, roof: number): void;
  update(t: number, kick: number, camera: THREE.Camera): void;
  cameraAt(stage: number, local: number, t: number): { pos: THREE.Vector3; look: THREE.Vector3 };
}

// The street model carries geometry, UVs and baked lightmaps; textures are applied here by material name
// (keeps the .glb small and avoids browsers that fail on embedded images).
const LIGHTMAPS = ['brick', 'pavement', 'road', 'kerb', 'trim', 'tile', 'dark', 'bollard', 'bark'];
const TEXTURES: Record<string, { map: string; normal?: string; rough?: string; tint: string }> = {
  brick: { map: 'red_brick_03_diff_web.jpg', normal: 'red_brick_03_nor_web.jpg', rough: 'red_brick_03_rough_web.jpg', tint: '#ffb08a' }, // orange-red Amsterdam School brick
  pavement: { map: 'concrete_pavement_02_diff_web.jpg', normal: 'concrete_pavement_02_nor_web.jpg', tint: '#55525a' },
  road: { map: 'asphalt_02_diff_web.jpg', normal: 'asphalt_02_nor_web.jpg', tint: '#3a383e' },
};
// night levels for the emissive parts (Blender's strengths are tuned for the bake, not for bloom)
const GLOW: Record<string, number> = { window_lit: 0.5, shop_lit: 0.06 };

async function loadStreet(scene: THREE.Scene): Promise<void> {
  const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('draco/'));
  // the private preview page can't serve .glb files, so it hands the model over inline (see scripts/preview-artifact.sh)
  const inline = (window as Window & { __STREET_GLB__?: ArrayBuffer }).__STREET_GLB__;
  const gltf = inline ? await loader.parseAsync(inline, '') : await loader.loadAsync('models/street.glb');
  const tl = new THREE.TextureLoader(), jobs: Promise<unknown>[] = [];
  const tex = (file: string, srgb: boolean) => { const t = tl.load(`models/textures/${file}`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  gltf.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m) return;
    if (m.name in GLOW) { m.emissiveIntensity = GLOW[m.name]; if (m.name !== 'shop_lit') m.color.set(0x000000); }
    const t = TEXTURES[m.name];
    if (t) { m.map = tex(t.map, true); m.color.set(t.tint); if (t.normal) m.normalMap = tex(t.normal, false); if (t.rough) m.roughnessMap = tex(t.rough, false); }
    if (m.name === 'leaf') { m.map = tex('leaves.png', true); m.alphaTest = 0.5; m.side = THREE.DoubleSide; m.color.set('#6f8a62'); }
    if (LIGHTMAPS.includes(m.name)) jobs.push(tl.loadAsync(`models/lightmaps/${m.name}.jpg`).then((lm) => {
      lm.flipY = false; lm.channel = 1; lm.colorSpace = THREE.SRGBColorSpace;
      m.lightMap = lm; m.lightMapIntensity = 0.85;
    }));
    m.envMapIntensity = 0; m.needsUpdate = true;
  });
  await Promise.all(jobs);
  scene.add(gltf.scene);
}

export function buildWorld(): World {
  const scene = new THREE.Scene();
  scene.background = C(PAL.bg);
  scene.fog = new THREE.FogExp2(C(PAL.bg), 0.012);
  const bricks = brick();
  const pulse: { mat: THREE.MeshBasicMaterial; base: THREE.Color; k: number }[] = []; // glowing things that breathe with the kick
  const glow = (c: THREE.Color, k = 1) => { const mat = glowMat(c.clone()); pulse.push({ mat, base: c.clone(), k }); return mat; };

  // ---------- sky (follows the camera so the horizon stays at eye level) ----------
  const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C(PAL.bg) }, mid: { value: C(PAL.b).multiplyScalar(0.55) }, low: { value: C(PAL.a) } },
    vertexShader: 'varying vec3 v; void main(){ v = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.); }',
    fragmentShader: 'uniform vec3 top, mid, low; varying vec3 v; void main(){ float h = v.y; vec3 c = h > .18 ? mix(mid, top, smoothstep(.18,.75,h)) : mix(low, mid, smoothstep(-.02,.18,h)); gl_FragColor = vec4(c,1.); }',
  }));
  sky.renderOrder = -1;
  scene.add(sky);
  scene.add(new THREE.HemisphereLight(C(PAL.b).lerp(C(PAL.fg), 0.4).multiplyScalar(0.6), C('#0a0510'), 0.35)); // low: the street's light is baked

  // ---------- 1 · the street ----------
  // faint cool moonlight for the parts without baked light (leaves, bikes), so they read as silhouettes
  const moon = new THREE.DirectionalLight(C('#8fa0ff'), 0.35); moon.position.set(-6, 12, 10); scene.add(moon);
  // Building, pavement, road, bikes, trees and the street lamp come from Blender (blender/street.py) with baked light.
  const ready = loadStreet(scene);

  // the door: plain black leaf, hinged on the left, swings inward
  const doorMat = new THREE.MeshStandardMaterial({ color: C('#040205'), roughness: 0.55 });
  const streetDoor = new THREE.Group(), streetLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.05), doorMat);
  streetLeaf.position.set(0.6, 1.15, 0); streetDoor.add(streetLeaf);
  streetDoor.position.set(-0.6, 0, -0.18);
  scene.add(streetDoor);

  // EPPING neon sign: orange and pink split layers behind a bright core, plus the light it throws on the bricks
  const wm = wordmarkGeometry(2.4);
  const signY = 2.95;
  const layers: [string, number, number][] = [[PAL.a, -0.028, 0.04], [PAL.b, 0.028, 0.045]];
  for (const [hex, dx, z] of layers) { const m = new THREE.Mesh(wm, glow(C(hex).multiplyScalar(1.3))); m.position.set(dx, signY, z); scene.add(m); }
  const signCore = new THREE.Mesh(wm, glow(C(PAL.fg).lerp(C(PAL.b), 0.45).multiplyScalar(1.05)));
  signCore.position.set(0, signY, 0.05); scene.add(signCore);
  const signLight = new THREE.PointLight(C(PAL.b), 14, 9, 2); signLight.position.set(0, signY, 0.8); scene.add(signLight);
  const leak = new THREE.PointLight(C(PAL.b), 0.5, 1.4, 2); leak.position.set(0, 0.03, 0.7); scene.add(leak); // light from under the door: only washes the pavement in front of it

  // velvet rope on two brass posts
  const brass = new THREE.MeshStandardMaterial({ color: C(PAL.a).lerp(C('#ffd28a'), 0.5), metalness: 0.85, roughness: 0.3 });
  const posts = [new THREE.Vector3(-1.75, 0, 0.95), new THREE.Vector3(-0.8, 0, 0.95)];
  for (const p of posts) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.95, 12), brass); post.position.copy(p).setY(0.475); scene.add(post);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), brass); knob.position.copy(p).setY(0.97); scene.add(knob);
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.03, 16), brass); foot.position.copy(p).setY(0.015); scene.add(foot);
  }
  const rope = new THREE.QuadraticBezierCurve3(posts[0].clone().setY(0.9), new THREE.Vector3(-1.275, 0.55, 0.95), posts[1].clone().setY(0.9));
  scene.add(new THREE.Mesh(new THREE.TubeGeometry(rope, 24, 0.022, 8), new THREE.MeshStandardMaterial({ color: C(PAL.b).multiplyScalar(0.55), roughness: 0.7 })));

  // ---------- 2 · the stairwell ----------
  // everything inside starts behind the facade (back face at z = -0.4), so nothing pokes through the brick
  const IN = -0.41, L = IN - ROOF_Z + 0.1, H = TOP_Y + CEIL + 1;
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), brickMat(bricks, L, H));
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * W / 2, H / 2, (IN + ROOF_Z - 0.1) / 2);
    scene.add(wall);
  }
  const floorMat = new THREE.MeshStandardMaterial({ color: C(PAL.bg).lerp(C(PAL.fg), 0.06), roughness: 0.85 });
  const landing = new THREE.Mesh(new THREE.PlaneGeometry(W, -Z0 + 0.4), floorMat); landing.rotation.x = -Math.PI / 2; landing.position.set(0, 0.001, Z0 / 2 - 0.2); scene.add(landing);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W, TOP_Z - ROOF_Z + 0.02), floorMat); top.rotation.x = -Math.PI / 2; top.position.set(0, TOP_Y, (TOP_Z + ROOF_Z) / 2); scene.add(top);

  // steps, each with a neon strip on its nose
  const steps = new THREE.InstancedMesh(new THREE.BoxGeometry(W, RISE, RUN), floorMat, N);
  const noses = new THREE.InstancedMesh(new THREE.BoxGeometry(W - 0.02, 0.018, 0.025), new THREE.MeshBasicMaterial({ toneMapped: false }), N);
  const m4 = new THREE.Matrix4(), noseBase: THREE.Color[] = [];
  for (let i = 0; i < N; i++) {
    const zf = Z0 - i * RUN;
    steps.setMatrixAt(i, m4.makeTranslation(0, i * RISE + RISE / 2, zf - RUN / 2));
    noses.setMatrixAt(i, m4.makeTranslation(0, (i + 1) * RISE - 0.009, zf - 0.012));
    noseBase.push(climbColor(zf).multiplyScalar(2));
    noses.setColorAt(i, noseBase[i]);
  }
  scene.add(steps, noses);

  // ceiling: dusk gradient along the climb, glass light panels all the way, neon strips on both edges
  const cy = (z: number) => (z > Z0 ? 0 : z < TOP_Z ? TOP_Y : stairY(z)) + CEIL;
  const ceilPts = [IN, Z0, TOP_Z, ROOF_Z - 0.1];
  for (let k = 0; k < 3; k++) {
    const za = ceilPts[k], zb = ceilPts[k + 1];
    const ca = C(PAL.bg).lerp(climbColor(za), 0.45), cb = C(PAL.bg).lerp(climbColor(zb), 0.45);
    scene.add(new THREE.Mesh(quad([new THREE.Vector3(-W / 2, cy(za), za), new THREE.Vector3(W / 2, cy(za), za), new THREE.Vector3(W / 2, cy(zb), zb), new THREE.Vector3(-W / 2, cy(zb), zb)], [ca, ca, cb, cb]),
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  for (let z = IN - 0.1; z > ROOF_Z + 0.6; z -= 0.9) {
    const z2 = z - 0.7, c1 = climbColor(z).multiplyScalar(1.6), c2 = climbColor(z2).multiplyScalar(1.6);
    const panel = new THREE.Mesh(quad([new THREE.Vector3(-0.45, cy(z) - 0.02, z), new THREE.Vector3(0.45, cy(z) - 0.02, z), new THREE.Vector3(0.45, cy(z2) - 0.02, z2), new THREE.Vector3(-0.45, cy(z2) - 0.02, z2)], [c1, c1, c2, c2]),
      new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide, transparent: true, opacity: 0.9 }));
    scene.add(panel);
  }
  const neonPieces = (x: number, h: (z: number) => number, r: number) => {
    for (let z = IN; z > ROOF_Z; z -= 0.6) {
      const z2 = Math.max(ROOF_Z, z - 0.6);
      scene.add(tube(new THREE.Vector3(x, h(z), z), new THREE.Vector3(x, h(z2), z2), r, glow(climbColor(z).multiplyScalar(2.4))));
    }
  };
  neonPieces(-W / 2 + 0.03, (z) => cy(z) - 0.04, 0.014);
  neonPieces(W / 2 - 0.03, (z) => cy(z) - 0.04, 0.014);
  neonPieces(W / 2 - 0.05, (z) => (z > Z0 ? 0 : z < TOP_Z ? TOP_Y : stairY(z)) + 0.9, 0.018); // handrail

  // coloured light along the climb
  const stairLights: { l: THREE.PointLight; base: number }[] = [];
  for (let k = 0; k <= 5; k++) {
    const z = lerp(-0.3, ROOF_Z + 0.5, k / 5), l = new THREE.PointLight(climbColor(z), 6, 5, 2);
    l.position.set(0, cy(z) - 0.5, z); scene.add(l); stairLights.push({ l, base: 6 });
  }

  // posters: album covers hung high on both walls
  const loader = new THREE.TextureLoader();
  POSTERS.forEach((src, i) => {
    const side = i % 2 ? 1 : -1, z = lerp(Z0 - 0.9, TOP_Z + 0.6, i / Math.max(1, POSTERS.length - 1));
    const tex = loader.load(src); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
    const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.68), new THREE.MeshStandardMaterial({ color: C('#0b080d'), roughness: 0.6 }));
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45 }));
    for (const [m, off] of [[frame, 0.005], [art, 0.008]] as const) {
      m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
      m.position.set(side * (W / 2 - off), stairY(z) + 1.95, z);
      scene.add(m);
    }
  });

  // top wall with the roof door
  const topShape = new THREE.Shape([V(-W / 2, TOP_Y), V(-0.55, TOP_Y), V(-0.55, TOP_Y + 2.2), V(0.55, TOP_Y + 2.2), V(0.55, TOP_Y), V(W / 2, TOP_Y), V(W / 2, TOP_Y + CEIL + 0.2), V(-W / 2, TOP_Y + CEIL + 0.2)]);
  const topWall = new THREE.Mesh(new THREE.ShapeGeometry(topShape), brickMat(bricks, 1, 1));
  (topWall.material as THREE.MeshStandardMaterial).map!.repeat.set(0.5, 0.5); (topWall.material as THREE.MeshStandardMaterial).bumpMap!.repeat.set(0.5, 0.5);
  topWall.position.z = ROOF_Z; scene.add(topWall);
  const frameMat = glow(C(PAL.b).multiplyScalar(2.6));
  const fz = ROOF_Z + 0.02;
  for (const [a, b] of [[[-0.57, 0], [-0.57, 2.22]], [[0.57, 0], [0.57, 2.22]], [[-0.57, 2.22], [0.57, 2.22]]] as const)
    scene.add(tube(new THREE.Vector3(a[0], TOP_Y + a[1], fz), new THREE.Vector3(b[0], TOP_Y + b[1], fz), 0.016, frameMat));
  const roofDoor = new THREE.Group(), roofLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.05), new THREE.MeshStandardMaterial({ color: C(PAL.bg).lerp(C(PAL.fg), 0.1), roughness: 0.5 }));
  roofLeaf.position.set(0.55, 1.1, 0); roofDoor.add(roofLeaf);
  roofDoor.position.set(-0.55, TOP_Y, ROOF_Z - 0.03); scene.add(roofDoor);

  // ---------- 3 · the roof ----------
  const RY = TOP_Y;
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: C('#140c16'), roughness: 0.95 }));
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, RY - 0.001, ROOF_Z - 20); scene.add(deck);
  const parapet = new THREE.Mesh(new THREE.BoxGeometry(40, 0.6, 0.3), new THREE.MeshStandardMaterial({ color: C('#1a1119'), roughness: 0.9 }));
  parapet.position.set(0, RY + 0.3, ROOF_Z - 16); scene.add(parapet);
  // Amsterdam skyline: gabled silhouettes with a few lit windows
  const R = (() => { let s = 9; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const silhouette = new THREE.MeshBasicMaterial({ color: C(PAL.bg).lerp(C('#000000'), 0.35) });
  const windowMat = glowMat(C(PAL.a).multiplyScalar(1.4));
  for (let i = 0; i < 46; i++) {
    const ang = -1.25 + (i / 45) * 2.5, dist = 45 + R() * 35, bw = 5 + R() * 6, bh = 4 + R() * 9, gable = R() > 0.35;
    const s = new THREE.Shape();
    s.moveTo(-bw / 2, -14); s.lineTo(-bw / 2, bh);
    if (gable) { s.lineTo(-bw / 4, bh); s.lineTo(-bw / 4, bh + 2.2); s.lineTo(bw / 4, bh + 2.2); s.lineTo(bw / 4, bh); }
    s.lineTo(bw / 2, bh); s.lineTo(bw / 2, -14);
    const b = new THREE.Mesh(new THREE.ShapeGeometry(s), silhouette);
    b.position.set(Math.sin(ang) * dist, RY - 6, ROOF_Z - Math.cos(ang) * dist);
    b.lookAt(0, RY - 6, ROOF_Z);
    scene.add(b);
    for (let k = 0; k < 4; k++) if (R() > 0.5) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 1), windowMat);
      win.position.set(-bw / 3 + R() * bw * 0.66, bh - 2 - R() * 6, 0.05); b.add(win);
    }
  }
  const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 48), glowMat(C(PAL.fg).lerp(C(PAL.a), 0.35).multiplyScalar(1.8)));
  sun.position.set(30, RY + 1, ROOF_Z - 160); sun.lookAt(0, RY + 1, ROOF_Z); scene.add(sun);
  // DJ table (the plank from the photos) with decks and blinking lights
  const wood = new THREE.MeshStandardMaterial({ color: C('#4a3424'), roughness: 0.8 });
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.7), wood); plank.position.set(0, RY + 1.0, ROOF_Z - 6.5); scene.add(plank);
  const deckBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.45), new THREE.MeshStandardMaterial({ color: C('#0b0a0c'), roughness: 0.4 }));
  deckBox.position.set(0, RY + 1.06, ROOF_Z - 6.5); scene.add(deckBox);
  const leds: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) { const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.03), glow(C(i % 3 ? PAL.b : PAL.a).multiplyScalar(2.5))); led.position.set(-0.4 + i * 0.09, RY + 1.1, ROOF_Z - 6.4); scene.add(led); leds.push(led); }
  scene.add(tube(new THREE.Vector3(-0.8, RY, ROOF_Z - 6.5), new THREE.Vector3(-0.8, RY + 1, ROOF_Z - 6.5), 0.03, wood), tube(new THREE.Vector3(0.8, RY, ROOF_Z - 6.5), new THREE.Vector3(0.8, RY + 1, ROOF_Z - 6.5), 0.03, wood));
  // festoon lights
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), glow(C(PAL.a).lerp(C(PAL.fg), 0.3).multiplyScalar(2.6)), 3 * 18);
  let bi = 0;
  for (const z of [ROOF_Z - 4.5, ROOF_Z - 7, ROOF_Z - 9.5]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 18; k++) { const u = k / 18, x = lerp(-6, 6, u); pts.push(new THREE.Vector3(x, RY + 3.4 - Math.sin(u * Math.PI) * 0.9, z)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C('#050305') })));
    for (let k = 1; k < 19 && bi < bulbs.count; k++) bulbs.setMatrixAt(bi++, m4.makeTranslation(pts[k - 1].x, pts[k - 1].y - 0.08, z));
  }
  scene.add(bulbs);
  const roofLight = new THREE.PointLight(C(PAL.a), 30, 18, 2); roofLight.position.set(0, RY + 3, ROOF_Z - 5); scene.add(roofLight);
  // smoke drifting from the booth
  const puffTex = puff(), smoke: { s: THREE.Sprite; ph: number; x: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: C(PAL.fg), transparent: true, opacity: 0.18, depthWrite: false }));
    scene.add(s); smoke.push({ s, ph: i / 12, x: (R() - 0.5) * 2.5 });
  }

  // ---------- behaviour ----------
  const setDoors = (street: number, roof: number) => { streetDoor.rotation.y = street * 1.85; roofDoor.rotation.y = roof * 1.85; };
  const tmp = new THREE.Color();
  function update(t: number, kick: number, camera: THREE.Camera) {
    sky.position.copy(camera.position);
    const k = 0.6 + 0.4 * kick;
    for (const p of pulse) p.mat.color.copy(p.base).multiplyScalar(lerp(1, k, p.k));
    for (let i = 0; i < N; i++) noses.setColorAt(i, tmp.copy(noseBase[i]).multiplyScalar(k));
    noses.instanceColor!.needsUpdate = true;
    for (const s of stairLights) s.l.intensity = s.base * (0.55 + 0.45 * kick);
    const flicker = Math.sin(t * 13) > 0.94 ? 0.35 : 1;
    signLight.intensity = 14 * k * flicker; signCore.visible = flicker > 0.5;
    leak.intensity = 0.5 * k;
    leds.forEach((l, i) => (l.visible = Math.sin(t * 8 + i * 1.7) > -0.2));
    for (const m of smoke) {
      const life = (t * 0.07 + m.ph) % 1;
      m.s.position.set(m.x + Math.sin(t * 0.4 + m.ph * 6) * 0.6, RY + 1.2 + life * 4, ROOF_Z - 6.8 - life * 1.5);
      m.s.scale.setScalar(1 + life * 4); (m.s.material as THREE.SpriteMaterial).opacity = 0.2 * (1 - life);
    }
  }

  // ---------- the camera's walk ----------
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  function cameraAt(stage: number, l: number, t: number) {
    if (stage === 0) { // walk up to the door
      const z = lerp(9, 1.5, ease(l)), walked = 9 - z;
      pos.set(Math.sin(walked * 0.9) * 0.03, 1.65 + Math.abs(Math.sin(walked * 4.2)) * 0.025, z);
      look.set(0, lerp(2.1, 1.6, ease(l)), -2);
    } else if (stage === 1) {
      if (l < 0.16) { // through the door
        const k = ease(l / 0.16), z = lerp(1.5, -0.6, k);
        pos.set(0, 1.65, z); look.set(0, lerp(1.6, 2.9, k), lerp(-2, -3.4, k));
      } else if (l < 0.88) { // the climb
        const k = ease((l - 0.16) / 0.72), z = lerp(-0.6, TOP_Z + 0.6, k), steps = (Z0 - z) / RUN;
        pos.set(0, stairY(z) + 1.6 + Math.abs(Math.sin(steps * Math.PI)) * 0.03, z);
        look.set(0, stairY(z - 2.4) + 1.5, z - 2.4);
      } else { // up to the roof door
        const k = ease((l - 0.88) / 0.12), z = lerp(TOP_Z + 0.6, ROOF_Z + 0.9, k);
        pos.set(0, TOP_Y + 1.6, z); look.set(0, lerp(stairY(TOP_Z) + 1.5, TOP_Y + 1.5, k), z - 2.4);
      }
    } else { // out onto the roof, then a slow look around
      const k = ease(clamp(l / 0.4)), z = lerp(ROOF_Z + 0.9, ROOF_Z - 2.0, k), drift = clamp((l - 0.4) / 0.6);
      pos.set(drift * 0.4, TOP_Y + 1.6, z - drift * 0.6);
      look.set(lerp(0, 2.5, ease(drift)) + Math.sin(t * 0.3) * 0.2, TOP_Y + lerp(1.6, 1.9, k), z - 10);
    }
    return { pos, look };
  }

  return { scene, ready, streetDoor: streetLeaf, roofDoor: roofLeaf, setDoors, update, cameraAt };
}
