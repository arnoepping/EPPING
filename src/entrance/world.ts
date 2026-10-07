import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import wordmark from '../components/wordmark.json';
import { POSTERS } from '../content/posters.ts';
import { PAL } from './palette.ts';
import { puff } from './textures.ts';

// One continuous world (metres, y up). The street is at z > 0, the facade at z = 0 with the door,
// the stairwell climbs toward -z inside the building, and the roof starts behind the top door.
export const N = 36, RISE = 0.24, RUN = 0.26, W = 2.0, Z0 = -1.0; // steep flight, ~43°
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

// Real brick (Poly Haven red_brick_03, same as the street) at 1.6 m per tile; w × h in metres.
const texLoader = new THREE.TextureLoader();
const texCache: Record<string, THREE.Texture> = {};
function texture(file: string, srgb: boolean, rx: number, ry: number): THREE.Texture {
  texCache[file] ??= texLoader.load(`models/textures/${file}`, (t) => { if (srgb) t.colorSpace = THREE.SRGBColorSpace; });
  const t = texCache[file].clone(); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.repeat.set(rx, ry);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
function brickMat(w: number, h: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    map: texture('red_brick_03_diff_web.jpg', true, w / 1.6, h / 1.6), normalMap: texture('red_brick_03_nor_web.jpg', false, w / 1.6, h / 1.6),
    roughnessMap: texture('red_brick_03_rough_web.jpg', false, w / 1.6, h / 1.6), color: C('#a07a72'), roughness: 1,
  });
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
  /** pitch-black plane just inside the street door, hiding the stairwell (teaser mode); hidden by default */
  blackout: THREE.Object3D;
  setDoors(street: number, roof: number): void;
  update(t: number, kick: number, camera: THREE.Camera): void;
  /** once the street is in: hands over the renderer for the stairwell's one-off reflection capture */
  reflect(renderer: THREE.WebGLRenderer): void;
  cameraAt(stage: number, local: number, t: number): { pos: THREE.Vector3; look: THREE.Vector3 };
}

// The street model carries geometry, UVs and baked lightmaps; textures are applied here by material name
// (keeps the .glb small and avoids browsers that fail on embedded images).
const LIGHTMAPS = ['brick', 'pavement', 'road', 'kerb', 'trim', 'tile', 'dark', 'bollard', 'bark', 'cafe_wall', 'cafe_panel', 'cafe_floor', 'cafe_wood', 'cafe_shade'];
// glass: plain dark panes, no reflections (the user didn't like them); the café glass stays see-through
// (for a closed, dark café: opacity 1 here and CAFE_LIT = False in blender/street.py, then re-bake)
const GLASS: Record<string, { opacity: number }> = { glass: { opacity: 1 }, shop_glass: { opacity: 1 }, cafe_glass: { opacity: 0.32 } };
const TEXTURES: Record<string, { map: string; normal?: string; rough?: string; tint: string }> = {
  brick: { map: 'red_brick_03_diff_web.jpg', normal: 'red_brick_03_nor_web.jpg', rough: 'red_brick_03_rough_web.jpg', tint: '#ffb08a' }, // orange-red Amsterdam School brick
  pavement: { map: 'concrete_pavement_02_diff_web.jpg', normal: 'concrete_pavement_02_nor_web.jpg', tint: '#55525a' },
  road: { map: 'asphalt_02_diff_web.jpg', normal: 'asphalt_02_nor_web.jpg', tint: '#3a383e' },
};
// night levels for the emissive parts (Blender's strengths are tuned for the bake, not for bloom)
const GLOW: Record<string, number> = { lamp: 4 };

async function loadStreet(scene: THREE.Scene, glass: THREE.MeshStandardMaterial[]): Promise<void> {
  const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('draco/'));
  // the private preview page can't serve .glb files, so it hands the model over inline (see scripts/preview-artifact.sh);
  // a promise there lets the preview fake a slow load to show the loader
  const inline = await (window as Window & { __STREET_GLB__?: ArrayBuffer | Promise<ArrayBuffer> }).__STREET_GLB__;
  const gltf = inline ? await loader.parseAsync(inline, '') : await loader.loadAsync('models/street.glb');
  const tl = new THREE.TextureLoader(), jobs: Promise<unknown>[] = [];
  // every texture counts toward ready: the 3D street replaces a still of itself, so nothing may pop in afterwards
  const tex = (file: string, srgb: boolean) => { let t!: THREE.Texture; jobs.push(new Promise((r) => (t = tl.load(`models/textures/${file}`, r, undefined, r)))); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  gltf.scene.traverse((o) => {
    const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
    if (!m) return;
    if (m.name in GLOW) { m.emissiveIntensity = GLOW[m.name]; m.color.set(0x000000); }
    const t = TEXTURES[m.name];
    if (t) { m.map = tex(t.map, true); m.color.set(t.tint); if (t.normal) m.normalMap = tex(t.normal, false); if (t.rough) m.roughnessMap = tex(t.rough, false); }
    if (m.name === 'leaf') { m.map = tex('leaves.png', true); m.alphaTest = 0.5; m.side = THREE.DoubleSide; m.color.set('#6f8a62'); }
    if (LIGHTMAPS.includes(m.name)) jobs.push(tl.loadAsync(`models/lightmaps/${m.name}.jpg`).then((lm) => {
      lm.flipY = false; lm.channel = 1; lm.colorSpace = THREE.SRGBColorSpace;
      m.lightMap = lm; m.lightMapIntensity = 0.85;
    }));
    m.envMapIntensity = 0;
    const g = GLASS[m.name];
    if (g) {
      m.color.set('#060508'); m.roughness = 0.1; m.metalness = 0; m.emissiveIntensity = 0; glass.push(m);
      if (g.opacity < 1) { m.transparent = true; m.opacity = g.opacity; m.depthWrite = false; (o as THREE.Mesh).renderOrder = 2; }
    }
    m.needsUpdate = true;
  });
  await Promise.all(jobs);
  scene.add(gltf.scene);
}

export function buildWorld(): World {
  const scene = new THREE.Scene();
  scene.background = C(PAL.bg);
  scene.fog = new THREE.FogExp2(C(PAL.bg), 0.012);
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
  const glassMats: THREE.MeshStandardMaterial[] = [];
  const ready = loadStreet(scene, glassMats);
  function reflect(renderer: THREE.WebGLRenderer) {
    rendererRef = renderer; if (stairsIn) captureStairs(renderer);
  }

  // dark ground just under the road: hairline cracks between kerb and road (seen on iPhones) showed the orange sky below the horizon
  const under = new THREE.Mesh(new THREE.PlaneGeometry(80, 40), new THREE.MeshBasicMaterial({ color: C('#020103') }));
  under.rotation.x = -Math.PI / 2; under.position.set(0, -0.26, 20); scene.add(under);

  // the door: plain black leaf, hinged on the left, swings inward
  const doorMat = new THREE.MeshStandardMaterial({ color: C('#040205'), roughness: 0.55 });
  const streetDoor = new THREE.Group(), streetLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.05), doorMat);
  streetLeaf.position.set(0.6, 1.15, 0); streetDoor.add(streetLeaf);
  streetDoor.position.set(-0.6, 0, 0.02); // hinge at the front of the reveal
  scene.add(streetDoor);
  // teaser: behind the open door there's nothing but black (sits just in front of the stairwell, which starts at z = -0.41)
  const blackout = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 3.0), new THREE.MeshBasicMaterial({ color: 0x000000, fog: false }));
  blackout.position.set(0, 1.45, -0.405); blackout.visible = false; scene.add(blackout);
  // a slim brushed pull bar on the right
  const pullMat = new THREE.MeshStandardMaterial({ color: C('#c4bfc8'), metalness: 0.7, roughness: 0.3 });
  const pull = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.42, 12), pullMat);
  pull.position.set(0.47, -0.1, 0.07); streetLeaf.add(pull);
  for (const dy of [-0.17, 0.17]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.045, 8), pullMat); post.rotation.x = Math.PI / 2; post.position.set(0.47, -0.1 + dy, 0.045); streetLeaf.add(post); }

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
  const unbaked: THREE.Object3D[] = []; // shown until the baked stairwell (blender/stairwell.py) has loaded
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), brickMat(L, H));
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * W / 2, H / 2, (IN + ROOF_Z - 0.1) / 2);
    scene.add(wall); unbaked.push(wall);
  }
  // dark polished stone steps that catch the neon
  const floorMat = new THREE.MeshStandardMaterial({ map: texture('concrete_pavement_02_diff_web.jpg', true, 1, 0.3), color: C('#3a3448'), roughness: 0.32, metalness: 0.1 });
  const landing = new THREE.Mesh(new THREE.PlaneGeometry(W, -Z0 + 0.4), floorMat); landing.rotation.x = -Math.PI / 2; landing.position.set(0, 0.001, Z0 / 2 - 0.2); scene.add(landing); unbaked.push(landing);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(W, TOP_Z - ROOF_Z + 0.02), floorMat); top.rotation.x = -Math.PI / 2; top.position.set(0, TOP_Y, (TOP_Z + ROOF_Z) / 2); scene.add(top); unbaked.push(top);

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
  scene.add(steps, noses); unbaked.push(steps);

  // ceiling: a light ceiling (Sunset rave gradient, pink at the bottom of the stairs → orange at the top, pulsing a little
  // with the beat) behind black panels in two rows; the light shows through the gaps between them. A black border frame
  // runs along the walls and the ends, so the panels stop in a frame instead of running into the brick.
  const cy = (z: number) => (z > Z0 ? 0 : z < TOP_Z ? TOP_Y : stairY(z)) + CEIL;
  const ceilPts = [IN, Z0, TOP_Z, ROOF_Z];
  const lightMat = glow(C('#ffffff').multiplyScalar(1.1), 0.35); lightMat.vertexColors = true;
  for (let k = 0; k < 3; k++) {
    const za = ceilPts[k], zb = ceilPts[k + 1], ca = climbColor(za), cb = climbColor(zb);
    scene.add(new THREE.Mesh(quad([new THREE.Vector3(-W / 2, cy(za), za), new THREE.Vector3(W / 2, cy(za), za), new THREE.Vector3(W / 2, cy(zb), zb), new THREE.Vector3(-W / 2, cy(zb), zb)], [ca, ca, cb, cb]), lightMat));
  }
  {
    const B = 0.16, G = 0.09, DEPTH = 0.035;                          // border width, light gap, panel depth (m)
    const PW = (W - 2 * B - 3 * G) / 2;                              // panel width: two rows across
    const panelMat = new THREE.MeshBasicMaterial({ color: C('#060408') }); // unlit: the blue fill below would otherwise light them up
    // panel edges catch the light from the gaps (backlit panels), so every gap reads as a light line, even at a steep angle
    const edgeMat = glow(C('#ffffff').multiplyScalar(0.75), 0.35);
    type Box = { m: THREE.Matrix4; z: number };
    const panelBoxes: Box[] = [], frameBoxes: Box[] = [];
    const xAxis = new THREE.Vector3(1, 0, 0);
    // a box lying flat against the ceiling of one section: centred at (x, along s), w across, l along
    const put = (into: Box[], p0: THREE.Vector3, d: THREE.Vector3, x: number, s: number, w: number, l: number) => {
      const up = xAxis.clone().cross(d), e3 = xAxis.clone().cross(up);
      const c = p0.clone().addScaledVector(d, s).setX(x).addScaledVector(up, -DEPTH / 2 - 0.004);
      into.push({ m: new THREE.Matrix4().makeBasis(xAxis, up, e3).setPosition(c).multiply(new THREE.Matrix4().makeScale(w, DEPTH, l)), z: c.z });
    };
    for (let k = 0; k < 3; k++) {
      const p0 = new THREE.Vector3(0, cy(ceilPts[k]), ceilPts[k]), p1 = new THREE.Vector3(0, cy(ceilPts[k + 1]), ceilPts[k + 1]);
      const d = p1.clone().sub(p0), L = d.length(); d.normalize();
      for (const x of [-(W - B) / 2, (W - B) / 2]) put(frameBoxes, p0, d, x, L / 2, B, L);  // side frames, unbroken
      if (k === 0) put(frameBoxes, p0, d, 0, B / 2, W - 2 * B, B);
      if (k === 2) put(frameBoxes, p0, d, 0, L - B / 2, W - 2 * B, B);
      const s0 = k === 0 ? B + G : G / 2, s1 = k === 2 ? B + G : G / 2;  // ends: frame + gap at the walls, half a gap at the bends
      const n = Math.max(1, Math.round((L - s0 - s1 + G) / (PW + G))), len = (L - s0 - s1 - (n - 1) * G) / n;
      for (let i = 0; i < n; i++) for (const x of [-(G + PW) / 2, (G + PW) / 2]) put(panelBoxes, p0, d, x, s0 + i * (len + G) + len / 2, PW, len);
    }
    // BoxGeometry faces: ±x, ±y (top, bottom), ±z; the bottom stays black, the sides glow
    const panels = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), [edgeMat, edgeMat, panelMat, panelMat, edgeMat, edgeMat], panelBoxes.length);
    panelBoxes.forEach(({ m, z }, i) => { panels.setMatrixAt(i, m); panels.setColorAt(i, climbColor(z)); });
    const frames = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), panelMat, frameBoxes.length);
    frameBoxes.forEach(({ m }, i) => frames.setMatrixAt(i, m));
    scene.add(panels, frames); // stay in the baked version too: their glowing edges keep every light line visible
  }
  // balustrades like the reference photo: vertical pink neon tubes on every other step, a dark metal handrail on top
  const railMat = new THREE.MeshStandardMaterial({ color: C('#16121c'), metalness: 0.8, roughness: 0.35 });
  const tubeMat = glow(C(PAL.b).multiplyScalar(2.8));
  const balusters = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.016, 0.016, 0.82, 8), tubeMat, N + 2);
  let bi0 = 0;
  for (let i = 0; i < N; i += 2) for (const side of [-1, 1]) {
    const z = Z0 - i * RUN - RUN / 2;
    balusters.setMatrixAt(bi0++, new THREE.Matrix4().makeTranslation(side * (W / 2 - 0.14), (i + 1) * RISE + 0.45, z));
  }
  balusters.count = bi0; scene.add(balusters);
  for (const side of [-1, 1]) {
    const x = side * (W / 2 - 0.14), h = (z: number) => (z > Z0 ? 0 : z < TOP_Z ? TOP_Y : stairY(z)) + 0.9;
    scene.add(tube(new THREE.Vector3(x, h(Z0), Z0), new THREE.Vector3(x, h(TOP_Z), TOP_Z), 0.024, railMat));
  }

  // The stairwell is lit by what you can see glowing: the ceiling (soft area lights just under it, one per stretch, in the
  // gradient, pulsing with the ceiling). The neon balusters and step edges only glow.
  RectAreaLightUniformsLib.init();
  const ceilLights: { l: THREE.RectAreaLight; base: number }[] = [];
  {
    const pieces: [number, number][] = [[IN, Z0]];
    for (let k = 0; k < 4; k++) pieces.push([lerp(Z0, TOP_Z, k / 4), lerp(Z0, TOP_Z, (k + 1) / 4)]);
    pieces.push([TOP_Z, ROOF_Z]);
    for (const [za, zb] of pieces) {
      const a = new THREE.Vector3(0, cy(za), za), b = new THREE.Vector3(0, cy(zb), zb), d = b.clone().sub(a);
      const down = d.clone().normalize().cross(new THREE.Vector3(1, 0, 0)).normalize(); // ceiling normal, pointing into the room
      const l = new THREE.RectAreaLight(climbColor((za + zb) / 2), 3.5, W - 0.4, d.length());
      l.position.copy(a).add(b).multiplyScalar(0.5).addScaledVector(down, 0.08);
      l.up.copy(d).normalize(); l.lookAt(l.position.clone().add(down));
      scene.add(l); ceilLights.push({ l, base: 3.5 });
    }
  }

  // posters: a pair at each spot, one on each wall, facing each other, hung high above the balustrade
  const loader = new THREE.TextureLoader();
  POSTERS.forEach((pair, i) => {
    const z = lerp(Z0 - 0.9, TOP_Z + 0.6, i / Math.max(1, POSTERS.length - 1));
    pair.forEach(({ src, aspect = 1 }, s) => {
      const side = s ? 1 : -1;
      const tex = loader.load(src); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
      const frame = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.62 * aspect + 0.06), new THREE.MeshStandardMaterial({ color: C('#0b080d'), roughness: 0.6 }));
      const art = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62 * aspect), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.45, emissiveMap: tex, emissive: C('#ffffff'), emissiveIntensity: 0.45 })); // backlit
      for (const [m, off] of [[frame, 0.005], [art, 0.008]] as const) {
        m.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
        m.position.set(side * (W / 2 - off), stairY(z) + 1.95, z);
        scene.add(m);
      }
    });
  });

  // top wall with the roof door
  const topShape = new THREE.Shape([V(-W / 2, TOP_Y), V(-0.55, TOP_Y), V(-0.55, TOP_Y + 2.2), V(0.55, TOP_Y + 2.2), V(0.55, TOP_Y), V(W / 2, TOP_Y), V(W / 2, TOP_Y + CEIL + 0.2), V(-W / 2, TOP_Y + CEIL + 0.2)]);
  const topWall = new THREE.Mesh(new THREE.ShapeGeometry(topShape), brickMat(1, 1)); // shape UVs are in metres
  topWall.position.z = ROOF_Z; scene.add(topWall); unbaked.push(topWall);
  const frameMat = glow(C(PAL.a).multiplyScalar(2.6)); // orange: the colour the climb ends in
  const fz = ROOF_Z + 0.02;
  for (const [a, b] of [[[-0.57, 0], [-0.57, 2.22]], [[0.57, 0], [0.57, 2.22]], [[-0.57, 2.22], [0.57, 2.22]]] as const)
    scene.add(tube(new THREE.Vector3(a[0], TOP_Y + a[1], fz), new THREE.Vector3(b[0], TOP_Y + b[1], fz), 0.016, frameMat));
  const roofDoor = new THREE.Group(), roofLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.05), new THREE.MeshStandardMaterial({ color: C(PAL.bg).lerp(C(PAL.fg), 0.1), roughness: 0.5 }));
  roofLeaf.position.set(0.55, 1.1, 0); roofDoor.add(roofLeaf);
  roofDoor.position.set(-0.55, TOP_Y, ROOF_Z - 0.03); scene.add(roofDoor);

  // The baked stairwell (blender/stairwell.py): streams in while the visitor is still outside, then replaces the live-lit
  // walls, steps, ceiling panels and roof door. Its light pulses with the beat through lightMapIntensity.
  const LM_GAIN = 16, ROOF_GAIN = 8; // overall brightness of the baked light (three.js divides light maps by π, and the textures are dark)
  const bakedMats: { m: THREE.MeshStandardMaterial; base: number; pulse: number }[] = [];
  const reflective: THREE.MeshStandardMaterial[] = [];
  let stairsIn = false, rendererRef: THREE.WebGLRenderer | null = null;
  const captureStairs = (renderer: THREE.WebGLRenderer) => { // what the polished steps and the door handle reflect
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.05, 30, rt); cam.position.set(0, stairY(-5) + 1.4, -5); scene.add(cam);
    cam.update(renderer, scene); scene.remove(cam);
    for (const m of reflective) { m.envMap = rt.texture; m.needsUpdate = true; }
  };
  const tl = new THREE.TextureLoader();
  const tex = (file: string, srgb: boolean) => { const t = tl.load(`models/textures/${file}`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  /** Loads a baked Blender model (blender/<name>.py): each mesh gets its material from `look` and its lightmap
   *  models/lightmaps/<name>_<mesh>.jpg, scaled back by the exposure the bake wrote to <name>.json. */
  async function loadBaked(name: string, glb: string, inlineVar: string, look: Record<string, () => THREE.MeshStandardMaterial>, gain: number, pulse: number) {
    const gl = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('draco/'));
    const inline = (window as unknown as Record<string, ArrayBuffer | undefined>)[inlineVar];
    const [gltf, exposure] = await Promise.all([
      inline ? gl.parseAsync(inline, '') : gl.loadAsync(`models/${glb}`),
      fetch(`models/lightmaps/${name}.json`).then((r) => r.json() as Promise<Record<string, number>>),
    ]);
    const meshes: THREE.Mesh[] = [];
    gltf.scene.traverse((o) => { if ((o as THREE.Mesh).isMesh && look[o.name]) meshes.push(o as THREE.Mesh); });
    await Promise.all(meshes.map(async (mesh) => {
      const m = look[mesh.name](), lm = await tl.loadAsync(`models/lightmaps/${name}_${mesh.name}.jpg`);
      lm.flipY = false; lm.channel = 1; lm.colorSpace = THREE.SRGBColorSpace;
      m.lightMap = lm; m.side = THREE.DoubleSide;
      const base = gain / (exposure[mesh.name] ?? 1); m.lightMapIntensity = base; bakedMats.push({ m, base, pulse });
      mesh.material = m;
    }));
    scene.add(gltf.scene);
    return meshes;
  }
  async function loadStairwell() {
    const meshes = await loadBaked('stair', 'stairwell.glb', '__STAIR_GLB__', {
      walls: () => new THREE.MeshStandardMaterial({ map: tex('red_brick_03_diff_web.jpg', true), normalMap: tex('red_brick_03_nor_web.jpg', false), roughnessMap: tex('red_brick_03_rough_web.jpg', false), color: C('#a07a72'), roughness: 1 }),
      floor: () => { const m = new THREE.MeshStandardMaterial({ map: tex('concrete_pavement_02_diff_web.jpg', true), color: C('#6a5f78'), roughness: 0.28, metalness: 0.1, envMapIntensity: 0.7 }); reflective.push(m); return m; },
      ceiling: () => new THREE.MeshStandardMaterial({ color: C('#0b080d'), roughness: 0.8 }),
      roof_leaf: () => new THREE.MeshStandardMaterial({ color: C('#1a181c'), roughness: 0.85 }), // plain matte black
      roof_handle: () => { const m = new THREE.MeshStandardMaterial({ color: C('#d6d6dc'), roughness: 0.25, metalness: 0.9 }); reflective.push(m); return m; },
    }, LM_GAIN, 0.5);
    for (const mesh of meshes) if (mesh.name.startsWith('roof_')) roofDoor.attach(mesh); // swings with the door
    for (const mesh of meshes) if (mesh.name === 'ceiling') mesh.visible = false;      // the live panels (lit edges) read better
    (roofLeaf.material as THREE.Material).visible = false;                               // stays as the click target
    for (const o of unbaked) o.visible = false;
    for (const c of ceilLights) c.l.visible = false;
    stairsIn = true;
    if (rendererRef) captureStairs(rendererRef);
  }
  const stairsBaked = ready.then(loadStairwell).catch((e) => console.error('baked stairwell failed', e));

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
  const legs = [tube(new THREE.Vector3(-0.8, RY, ROOF_Z - 6.5), new THREE.Vector3(-0.8, RY + 1, ROOF_Z - 6.5), 0.03, wood), tube(new THREE.Vector3(0.8, RY, ROOF_Z - 6.5), new THREE.Vector3(0.8, RY + 1, ROOF_Z - 6.5), 0.03, wood)];
  scene.add(...legs);
  // festoon lights
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), glow(C(PAL.a).lerp(C(PAL.fg), 0.3).multiplyScalar(2.6)), 3 * 18);
  let bi = 0;
  for (const z of [ROOF_Z - 2.2, ROOF_Z - 4.4, ROOF_Z - 6.6]) { // over the (smaller) terrace, as in blender/roof.py
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 18; k++) { const u = k / 18, x = lerp(-4, 4, u); pts.push(new THREE.Vector3(x, RY + 3.4 - Math.sin(u * Math.PI) * 0.7, z)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C('#050305') })));
    for (let k = 1; k < 19 && bi < bulbs.count; k++) bulbs.setMatrixAt(bi++, m4.makeTranslation(pts[k - 1].x, pts[k - 1].y - 0.08, z));
  }
  scene.add(bulbs);
  const roofLight = new THREE.PointLight(C(PAL.a), 30, 18, 2); roofLight.position.set(0, RY + 3, ROOF_Z - 5); scene.add(roofLight);

  // The baked roof (blender/roof.py, spec docs/superpowers/specs/2026-10-04-roof-v2.md): wooden deck, parapet with
  // pantiles, the DJ booth and two column speakers. Streams in after the stairwell; until then the plain roof above shows.
  const BZ = ROOF_Z - 7.0, BH = 1.0; // as in blender/roof.py: the booth close to the far wall
  const boothLed = new THREE.Group(); // the warm LED strip under the booth top (its light is in the bake) + two small lights
  const at = (m: THREE.Mesh, x: number, y: number, z: number) => { m.position.set(x, y, z); boothLed.add(m); };
  at(new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.015, 0.02), glow(C('#ff9a3a').multiplyScalar(1.4), 0.6)), 0, RY + BH - 0.015, BZ + 0.48);
  for (const sx of [-1, 1]) {
    at(new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.015, 0.9), glow(C('#ff9a3a').multiplyScalar(1.4), 0.6)), sx * 1.08, RY + BH - 0.015, BZ + 0.05);
    at(new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.06, 0.04), glow(C('#ffc890').multiplyScalar(2.4), 0.2)), sx * 0.85, RY + BH + 0.09, BZ + 0.38);
  }
  boothLed.visible = false; scene.add(boothLed);
  const grilleTex = () => { // small round holes, as on a speaker's metal grille (UVs are in metres)
    const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#1a1a1e';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { g.beginPath(); g.arc(x * 8 + 4 + (y % 2) * 4, y * 8 + 4, 2.6, 0, Math.PI * 2); g.fill(); }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(12, 12); t.colorSpace = THREE.SRGBColorSpace; return t;
  };
  async function loadRoof() {
    const dark = () => new THREE.MeshStandardMaterial({ color: C('#141216'), roughness: 0.45 });
    await loadBaked('roof', 'roof.glb', '__ROOF_GLB__', {
      deck: () => new THREE.MeshStandardMaterial({ map: tex('plank_flooring_04_diff_web.jpg', true), normalMap: tex('plank_flooring_04_nor_web.jpg', false), roughnessMap: tex('plank_flooring_04_rough_web.jpg', false), color: C('#c09078'), roughness: 1 }),
      plaster: () => new THREE.MeshStandardMaterial({ map: tex('white_plaster_rough_01_diff_web.jpg', true), normalMap: tex('white_plaster_rough_01_nor_web.jpg', false), color: C('#d8d2cc'), roughness: 0.95 }),
      brick: () => new THREE.MeshStandardMaterial({ map: tex('red_brick_03_diff_web.jpg', true), normalMap: tex('red_brick_03_nor_web.jpg', false), color: C('#a07a72'), roughness: 1 }),
      tiles: () => new THREE.MeshStandardMaterial({ color: C('#b8502a'), roughness: 0.5 }),
      booth_body: () => new THREE.MeshStandardMaterial({ color: C('#7a5638'), roughness: 0.55 }), // warm wood
      booth_top: dark, gear: dark,
      speaker: () => new THREE.MeshStandardMaterial({ color: C('#3a3840'), roughness: 0.4, metalness: 0.15 }), // satin black cabinets
      grille: () => new THREE.MeshStandardMaterial({ map: grilleTex(), color: C('#9a98a4'), roughness: 0.5, metalness: 0.6 }), // perforated metal
      logo: () => new THREE.MeshStandardMaterial({ color: C('#e8e6ee'), roughness: 0.4 }),
    }, ROOF_GAIN, 0.4);
    for (const o of [deck, parapet, plank, deckBox, ...legs]) o.visible = false;
    roofLight.visible = false; boothLed.visible = true;
    leds.forEach((l, i) => l.position.set(-0.58 + i * 0.13, RY + BH + 0.165, BZ + 0.2)); // on top of the decks and mixer
  }
  stairsBaked.then(loadRoof).catch((e) => console.error('baked roof failed', e));
  // smoke drifting from the booth
  const puffTex = puff(), smoke: { s: THREE.Sprite; ph: number; x: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: C(PAL.fg), transparent: true, opacity: 0.18, depthWrite: false }));
    scene.add(s); smoke.push({ s, ph: i / 12, x: (R() - 0.5) * 2.5 });
  }

  // ---------- behaviour ----------
  // the street door opens outward (toward you) so the stairwell stays clear; the roof door opens onto the roof
  const setDoors = (street: number, roof: number) => { streetDoor.rotation.y = -street * 1.85; roofDoor.rotation.y = roof * 1.85; };
  const tmp = new THREE.Color();
  function update(t: number, kick: number, camera: THREE.Camera) {
    sky.position.copy(camera.position);
    const k = 0.6 + 0.4 * kick;
    for (const p of pulse) p.mat.color.copy(p.base).multiplyScalar(lerp(1, k, p.k));
    for (let i = 0; i < N; i++) noses.setColorAt(i, tmp.copy(noseBase[i]).multiplyScalar(k));
    noses.instanceColor!.needsUpdate = true;
    for (const c of ceilLights) c.l.intensity = c.base * lerp(1, k, 0.35); // same pulse as the glowing ceiling
    for (const b of bakedMats) b.m.lightMapIntensity = b.base * lerp(1, k, b.pulse); // the baked light pulses too
    const flicker = Math.sin(t * 13) > 0.94 ? 0.35 : 1;
    signLight.intensity = 14 * k * flicker; signCore.visible = flicker > 0.5;
    leak.intensity = 0.5 * k;
    leds.forEach((l, i) => (l.visible = Math.sin(t * 8 + i * 1.7) > -0.2));
    for (const m of smoke) {
      const life = (t * 0.07 + m.ph) % 1;
      m.s.position.set(m.x + Math.sin(t * 0.4 + m.ph * 6) * 0.6, RY + 1.2 + life * 4, ROOF_Z - 7.3 - life * 1.5);
      m.s.scale.setScalar(1 + life * 4); (m.s.material as THREE.SpriteMaterial).opacity = 0.2 * (1 - life);
    }
  }

  // ---------- the camera's walk ----------
  const pos = new THREE.Vector3(), look = new THREE.Vector3();
  function cameraAt(stage: number, l: number, t: number) {
    if (stage === 0) { // walk up to the door: steady pace (no easing), so the walk flows into the doorway at the same speed
      const z = lerp(9, 1.5, l), walked = 9 - z;
      pos.set(Math.sin(walked * 0.9) * 0.03, 1.65 + Math.abs(Math.sin(walked * 4.2)) * 0.025, z);
      look.set(0, lerp(2.1, 1.6, ease(l)), -2);
    } else if (stage === 1) {
      if (l < 0.2) { // through the door, at the walk's pace (2.1 m over 0.084 of p ≈ 7.5 m over 0.3); only the look eases
        const k = ease(l / 0.2), z = lerp(1.5, -0.6, l / 0.2);
        pos.set(0, 1.65, z); look.set(0, lerp(1.6, 2.9, k), lerp(-2, -3.4, k));
      } else if (l < 0.88) { // the climb
        const k = ease((l - 0.2) / 0.68), z = lerp(-0.6, TOP_Z + 0.6, k), steps = (Z0 - z) / RUN;
        pos.set(0, stairY(z) + 1.6 + Math.abs(Math.sin(steps * Math.PI)) * 0.03, z);
        look.set(0, stairY(z - 2.4) + 1.5, z - 2.4);
      } else { // up to the roof door
        const k = ease((l - 0.88) / 0.12), z = lerp(TOP_Z + 0.6, ROOF_Z + 0.9, k);
        pos.set(0, TOP_Y + 1.6, z); look.set(0, lerp(stairY(TOP_Z) + 1.5, TOP_Y + 1.5, k), z - 2.4);
      }
    } else { // out onto the roof and straight on to the DJ booth; the finale clip takes over right in front of it
      const stop = lerp(ROOF_Z - 3.0, ROOF_Z - 4.6, clamp((innerWidth / innerHeight - 0.45) / 1.1)); // phones stop further back
      const k = ease(clamp(l / 0.6)), z = lerp(ROOF_Z + 0.9, stop, k);
      pos.set(0, TOP_Y + 1.6 - k * 0.05, z);
      look.set(Math.sin(t * 0.3) * 0.05, TOP_Y + lerp(1.6, 1.3, k), z - 4);
    }
    return { pos, look };
  }

  return { scene, ready, streetDoor: streetLeaf, roofDoor: roofLeaf, blackout, setDoors, update, reflect, cameraAt };
}
