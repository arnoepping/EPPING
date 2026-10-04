import * as THREE from 'three';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import wordmark from '../components/wordmark.json';
import { POSTERS } from '../content/posters.ts';
import { PAL } from './palette.ts';
import { FLOORS } from '../content/floors.ts';
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
  setDoors(street: number, roof: number): void;
  update(t: number, kick: number, camera: THREE.Camera): void;
  /** once the street is in: render what the shop glass reflects (one cube capture, not per frame) */
  reflect(renderer: THREE.WebGLRenderer): void;
  cameraAt(stage: number, local: number, t: number): { pos: THREE.Vector3; look: THREE.Vector3 };
}

// The street model carries geometry, UVs and baked lightmaps; textures are applied here by material name
// (keeps the .glb small and avoids browsers that fail on embedded images).
const LIGHTMAPS = ['brick', 'pavement', 'road', 'kerb', 'trim', 'tile', 'dark', 'bollard', 'bark', 'cafe_wall', 'cafe_panel', 'cafe_floor', 'cafe_wood', 'cafe_shade'];
// glass that reflects the street (env map rendered once the street is in, see World.reflect)
const GLASS: Record<string, { opacity: number; metal: number }> = { glass: { opacity: 1, metal: 0.85 }, shop_glass: { opacity: 1, metal: 1 }, cafe_glass: { opacity: 0.32, metal: 0.6 } };
const TEXTURES: Record<string, { map: string; normal?: string; rough?: string; tint: string }> = {
  brick: { map: 'red_brick_03_diff_web.jpg', normal: 'red_brick_03_nor_web.jpg', rough: 'red_brick_03_rough_web.jpg', tint: '#ffb08a' }, // orange-red Amsterdam School brick
  pavement: { map: 'concrete_pavement_02_diff_web.jpg', normal: 'concrete_pavement_02_nor_web.jpg', tint: '#55525a' },
  road: { map: 'asphalt_02_diff_web.jpg', normal: 'asphalt_02_nor_web.jpg', tint: '#3a383e' },
};
// night levels for the emissive parts (Blender's strengths are tuned for the bake, not for bloom)
const GLOW: Record<string, number> = { window_lit: 0.5, lamp: 4 };

async function loadStreet(scene: THREE.Scene, glass: THREE.MeshStandardMaterial[]): Promise<void> {
  const loader = new GLTFLoader().setDRACOLoader(new DRACOLoader().setDecoderPath('draco/'));
  // the private preview page can't serve .glb files, so it hands the model over inline (see scripts/preview-artifact.sh)
  const inline = (window as Window & { __STREET_GLB__?: ArrayBuffer }).__STREET_GLB__;
  const gltf = inline ? await loader.parseAsync(inline, '') : await loader.loadAsync('models/street.glb');
  const tl = new THREE.TextureLoader(), jobs: Promise<unknown>[] = [];
  const tex = (file: string, srgb: boolean) => { const t = tl.load(`models/textures/${file}`); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; t.flipY = false; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
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
      m.color.set('#a8a2b0'); m.roughness = 0.04; m.metalness = g.metal; m.envMapIntensity = 0.45; glass.push(m);
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
    uniforms: { top: { value: C('#070b2a') }, mid: { value: C('#4a2a8a') }, low: { value: C('#ff6b5e') } }, // blue hour: deep blue → purple → warm horizon
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
    const rt = new THREE.WebGLCubeRenderTarget(256, { type: THREE.HalfFloatType });
    const cam = new THREE.CubeCamera(0.1, 400, rt); cam.position.set(0, 1.6, 4); scene.add(cam);
    // the houses across the street (behind the camera, so only ever seen in the glass): dark facades, a few lit rooms, a street lamp
    const oc = document.createElement('canvas'); oc.width = 1024; oc.height = 256;
    { const g = oc.getContext('2d')!; g.fillStyle = '#0c0910'; g.fillRect(0, 0, 1024, 256);
      for (let x = 0; x < 1024; x += 12) for (let y = 50; y < 240; y += 38) {
        const r = Math.random(); g.fillStyle = r < 0.16 ? '#ffb46a' : r < 0.2 ? '#ff8a4c' : '#17131c'; g.fillRect(x + 3, y, 6, 18);
      } }
    const ot = new THREE.CanvasTexture(oc); ot.colorSpace = THREE.SRGBColorSpace;
    const opposite = new THREE.Group();
    const facade = new THREE.Mesh(new THREE.PlaneGeometry(90, 17), new THREE.MeshBasicMaterial({ map: ot, fog: false }));
    facade.position.set(0, 5.5, 28); facade.rotation.y = Math.PI; opposite.add(facade);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.35), new THREE.MeshBasicMaterial({ color: C('#ffc890'), fog: false }));
    lamp.position.set(6, 5, 15); opposite.add(lamp);
    scene.add(opposite);
    sky.position.copy(cam.position); cam.update(renderer, scene); scene.remove(cam, opposite);
    for (const m of glassMats) { m.envMap = rt.texture; m.needsUpdate = true; }
  }

  // Epping Presents flyer taped inside the left shop window, next to the door
  const presents = FLOORS.find((f) => f.slug === 'presents');
  const fc = document.createElement('canvas'); fc.width = 512; fc.height = 724;
  const flyerTex = new THREE.CanvasTexture(fc); flyerTex.colorSpace = THREE.SRGBColorSpace; flyerTex.anisotropy = 8;
  const drawFlyer = () => {
    const g = fc.getContext('2d')!, W = fc.width, H = fc.height;
    const bg = g.createLinearGradient(0, 0, 0, H); bg.addColorStop(0, PAL.b); bg.addColorStop(1, PAL.a);
    g.fillStyle = bg; g.fillRect(0, 0, W, H);
    g.fillStyle = PAL.bg; g.fillRect(28, 28, W - 56, H - 56);
    g.fillStyle = PAL.fg; g.textAlign = 'center';
    g.font = '800 92px Unbounded, Arial Black, sans-serif'; g.fillText('EPPING', W / 2, 170);
    g.font = '500 30px "JetBrains Mono", monospace'; g.fillStyle = PAL.b; g.fillText('P R E S E N T S', W / 2, 220);
    const ev = presents?.event;
    const [what, when] = ev ? ev.note.split(' · ') : ['Our own nights', ''];
    g.fillStyle = PAL.fg; g.font = '800 52px Unbounded, Arial Black, sans-serif';
    (ev ? what.replace(/ during .*/, '') : 'Get on the list').toUpperCase().split(' ').reduce<string[]>((ls, w) => { const l = ls.at(-1); if (l && (l + ' ' + w).length <= 9) ls[ls.length - 1] = l + ' ' + w; else ls.push(w); return ls; }, [])
      .forEach((l, i) => g.fillText(l, W / 2, 350 + i * 62));
    g.font = '500 28px "JetBrains Mono", monospace'; g.fillStyle = PAL.a;
    if (ev) { g.fillText(ev.date.replace(/ \d{4}$/, '').toUpperCase(), W / 2, 540); g.fillText(when, W / 2, 582); g.fillStyle = PAL.fg; g.fillText(ev.place.split(',')[0].toUpperCase(), W / 2, 640); }
    else { g.fillStyle = PAL.fg; g.fillText('@EPPING.MUSIC', W / 2, 600); }
    flyerTex.needsUpdate = true;
  };
  drawFlyer();
  document.fonts?.load('800 52px Unbounded').then(() => document.fonts.load('500 28px "JetBrains Mono"')).then(drawFlyer).catch(() => {});
  const flyer = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.85), new THREE.MeshStandardMaterial({ map: flyerTex, emissiveMap: flyerTex, emissive: C('#ffffff'), emissiveIntensity: 0.18, roughness: 0.85 }));
  flyer.position.set(-2.5, 1.6, 0.037); flyer.rotation.z = 0.025; scene.add(flyer);

  // the door: plain black leaf, hinged on the left, swings inward
  const doorMat = new THREE.MeshStandardMaterial({ color: C('#040205'), roughness: 0.55 });
  const streetDoor = new THREE.Group(), streetLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 0.05), doorMat);
  streetLeaf.position.set(0.6, 1.15, 0); streetDoor.add(streetLeaf);
  streetDoor.position.set(-0.6, 0, 0.02); // hinge at the front of the reveal
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
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(L, H), brickMat(L, H));
    wall.rotation.y = side < 0 ? Math.PI / 2 : -Math.PI / 2;
    wall.position.set(side * W / 2, H / 2, (IN + ROOF_Z - 0.1) / 2);
    scene.add(wall);
  }
  // dark polished stone steps that catch the neon
  const floorMat = new THREE.MeshStandardMaterial({ map: texture('concrete_pavement_02_diff_web.jpg', true, 1, 0.3), color: C('#3a3448'), roughness: 0.32, metalness: 0.1 });
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

  // ceiling, after the club reference: a triangular grid of warm light lines with spots where they cross,
  // over a brand-palette gradient (pink at the bottom of the stairs → orange at the top) instead of black
  const cy = (z: number) => (z > Z0 ? 0 : z < TOP_Z ? TOP_Y : stairY(z)) + CEIL;
  const ceilPts = [IN, Z0, TOP_Z, ROOF_Z - 0.1];
  const baseAt = (z: number) => C(PAL.bg).lerp(climbColor(z), 0.55); // Sunset rave gradient, toned so the grid still reads
  for (let k = 0; k < 3; k++) {
    const za = ceilPts[k], zb = ceilPts[k + 1], ca = baseAt(za), cb = baseAt(zb);
    scene.add(new THREE.Mesh(quad([new THREE.Vector3(-W / 2, cy(za), za), new THREE.Vector3(W / 2, cy(za), za), new THREE.Vector3(W / 2, cy(zb), zb), new THREE.Vector3(-W / 2, cy(zb), zb)], [ca, ca, cb, cb]),
      new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  }
  const ceilColor = (z: number) => C(PAL.fg).lerp(climbColor(z), 0.25); // warm cream lines, a hint of the gradient
  {
    const S = 0.75, H3 = (S * Math.sqrt(3)) / 2, x0 = -W / 2 + 0.03, x1 = W / 2 - 0.03, zTop = IN - 0.02, zEnd = ROOF_Z + 0.05;
    const at = (x: number, z: number) => new THREE.Vector3(x, cy(z) - 0.025, z);
    // clip a 2D segment (x, z) to the ceiling rectangle (Liang-Barsky)
    const clip = (ax: number, az: number, bx: number, bz: number): number[] | null => {
      let t0 = 0, t1 = 1; const dx = bx - ax, dz = bz - az;
      for (const [p, q] of [[-dx, ax - x0], [dx, x1 - ax], [-dz, az - zEnd], [dz, zTop - az]]) {
        if (p === 0) { if (q < 0) return null; continue; }
        const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
      }
      return [ax + t0 * dx, az + t0 * dz, ax + t1 * dx, az + t1 * dz];
    };
    const segs: number[][] = [], spots: number[][] = [];
    for (let i = -3; i < 30; i++) for (let j = -3; j <= 3; j++) {
      const px = j * H3, pz = zTop - i * S + (j % 2 ? S / 2 : 0);   // lattice point
      if (px >= x0 && px <= x1 && pz <= zTop && pz >= zEnd) spots.push([px, pz]);
      for (const [dx, dz] of [[0, -S], [H3, -S / 2], [H3, S / 2]]) { const c = clip(px, pz, px + dx, pz + dz); if (c) segs.push(c); }
    }
    const strip = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.012, 0.012, 1, 6), glowMat(C('#ffffff').multiplyScalar(0.8)), segs.length); // steady (not tied to the beat), at the old pulse's average
    const up = new THREE.Vector3(0, 1, 0), m = new THREE.Matrix4(), qt = new THREE.Quaternion();
    segs.forEach(([ax, az, bx, bz], k) => {
      const a = at(ax, az), b = at(bx, bz), len = a.distanceTo(b);
      qt.setFromUnitVectors(up, b.clone().sub(a).normalize());
      m.compose(a.clone().add(b).multiplyScalar(0.5), qt, new THREE.Vector3(1, len, 1));
      strip.setMatrixAt(k, m); strip.setColorAt(k, ceilColor((az + bz) / 2).multiplyScalar(1.6));
    });
    scene.add(strip);
    const dots = new THREE.InstancedMesh(new THREE.CircleGeometry(0.035, 12), glowMat(C('#fff1d6').multiplyScalar(2.5)), spots.length);
    spots.forEach(([x, z], k) => { const p = at(x, z); p.y -= 0.01; m.compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, 0, 0)), new THREE.Vector3(1, 1, 1)); dots.setMatrixAt(k, m); });
    scene.add(dots);
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

  // coloured light along the climb
  const stairLights: { l: THREE.PointLight; base: number }[] = [];
  for (let k = 0; k <= 5; k++) {
    const z = lerp(-0.3, ROOF_Z + 0.5, k / 5), l = new THREE.PointLight(climbColor(z), 6, 5, 2);
    l.position.set(0, cy(z) - 0.5, z); scene.add(l); stairLights.push({ l, base: 6 });
  }

  // light at the foot of the stairs, so stepping through the door isn't into a black hole
  const foot = new THREE.PointLight(C(PAL.b), 8, 4, 2); foot.position.set(0, 2.2, Z0 + 0.1); scene.add(foot);
  // cool blue fill from above: the contrast colour from the reference, so the pink reads as neon
  for (let k = 0; k < 3; k++) {
    const z = lerp(Z0 - 1, TOP_Z + 1, k / 2), l = new THREE.PointLight(C('#3d4dff'), 5, 7, 2);
    l.position.set(0, cy(z) - 0.3, z); scene.add(l);
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
      m.position.set(side * (W / 2 - off), stairY(z) + 1.95, z); // high, above the balustrade
      scene.add(m);
    }
  });

  // top wall with the roof door
  const topShape = new THREE.Shape([V(-W / 2, TOP_Y), V(-0.55, TOP_Y), V(-0.55, TOP_Y + 2.2), V(0.55, TOP_Y + 2.2), V(0.55, TOP_Y), V(W / 2, TOP_Y), V(W / 2, TOP_Y + CEIL + 0.2), V(-W / 2, TOP_Y + CEIL + 0.2)]);
  const topWall = new THREE.Mesh(new THREE.ShapeGeometry(topShape), brickMat(1, 1)); // shape UVs are in metres
  topWall.position.z = ROOF_Z; scene.add(topWall);
  const frameMat = glow(C(PAL.b).multiplyScalar(2.6));
  const fz = ROOF_Z + 0.02;
  for (const [a, b] of [[[-0.57, 0], [-0.57, 2.22]], [[0.57, 0], [0.57, 2.22]], [[-0.57, 2.22], [0.57, 2.22]]] as const)
    scene.add(tube(new THREE.Vector3(a[0], TOP_Y + a[1], fz), new THREE.Vector3(b[0], TOP_Y + b[1], fz), 0.016, frameMat));
  // three glowing panels above the roof door, like the lit panels at the top of the reference stairs
  for (const px of [-0.45, 0, 0.45]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.62), glowMat(C('#9fb4ff').multiplyScalar(1.5)));
    panel.position.set(px, TOP_Y + 2.62, ROOF_Z + 0.015); scene.add(panel);
  }
  const roofDoor = new THREE.Group(), roofLeaf = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.2, 0.05), new THREE.MeshStandardMaterial({ color: C(PAL.bg).lerp(C(PAL.fg), 0.1), roughness: 0.5 }));
  roofLeaf.position.set(0.55, 1.1, 0); roofDoor.add(roofLeaf);
  roofDoor.position.set(-0.55, TOP_Y, ROOF_Z - 0.03); scene.add(roofDoor);

  // ---------- 3 · the roof ---------- (after the rooftop-party reference: blue hour, glass railing, glowing bar, crowd)
  const RY = TOP_Y, R = (() => { let sd = 9; return () => ((sd = (sd * 16807) % 2147483647) / 2147483647); })();
  const EDGE = ROOF_Z - 16, VIOLET = '#9a4dff';
  const deck = new THREE.Mesh(new THREE.PlaneGeometry(24, 18), new THREE.MeshStandardMaterial({ map: texture('concrete_pavement_02_diff_web.jpg', true, 10, 8), color: C('#4a3f5c'), roughness: 0.55, metalness: 0.1 }));
  deck.rotation.x = -Math.PI / 2; deck.position.set(0, RY - 0.001, ROOF_Z - 8); scene.add(deck);

  // glass railing around the roof edge, metal top rail, a violet LED strip along the foot
  const glass = new THREE.MeshStandardMaterial({ color: C('#9fb7ff'), transparent: true, opacity: 0.12, roughness: 0.05, metalness: 0.2, depthWrite: false });
  const rail = new THREE.MeshStandardMaterial({ color: C('#2a2533'), metalness: 0.9, roughness: 0.3 });
  const led = glow(C(VIOLET).multiplyScalar(2.4), 0.5);
  for (const [x0, z0, x1, z1] of [[-12, EDGE, 12, EDGE], [-9, ROOF_Z - 1, -9, EDGE], [9, ROOF_Z - 1, 9, EDGE]]) {
    const len = Math.hypot(x1 - x0, z1 - z0), mid = new THREE.Vector3((x0 + x1) / 2, RY + 0.55, (z0 + z1) / 2), ang = Math.atan2(z1 - z0, x1 - x0);
    const pane = new THREE.Mesh(new THREE.BoxGeometry(len, 1.1, 0.02), glass); pane.position.copy(mid); pane.rotation.y = -ang; scene.add(pane);
    scene.add(tube(new THREE.Vector3(x0, RY + 1.12, z0), new THREE.Vector3(x1, RY + 1.12, z1), 0.03, rail));
    scene.add(tube(new THREE.Vector3(x0, RY + 0.03, z0), new THREE.Vector3(x1, RY + 0.03, z1), 0.02, led));
  }

  // the skyline: blocks of flats and a few towers, thousands of lit windows (one shared window texture)
  const winCanvas = document.createElement('canvas'); winCanvas.width = 256; winCanvas.height = 512;
  { const g = winCanvas.getContext('2d')!; g.fillStyle = '#0a0812'; g.fillRect(0, 0, 256, 512);
    for (let y = 0; y < 512; y += 16) for (let x = 0; x < 256; x += 16) {
      const r = R(); if (r > 0.42) continue;
      g.fillStyle = r < 0.08 ? '#a9c4ff' : r < 0.3 ? '#ffb46a' : '#ff8a4c'; g.globalAlpha = 0.45 + R() * 0.55;
      g.fillRect(x + 4, y + 5, 8, 8);
    } g.globalAlpha = 1; }
  const winTex = new THREE.CanvasTexture(winCanvas); winTex.colorSpace = THREE.SRGBColorSpace; winTex.wrapS = winTex.wrapT = THREE.RepeatWrapping;
  for (let i = 0; i < 70; i++) {
    const ang = -1.35 + (i / 69) * 2.7 + (R() - 0.5) * 0.04, dist = 40 + R() * 80, tower = R() < 0.07; // mostly low-rise, a few towers in the distance
    const w = 8 + R() * 14, h = tower ? 24 + R() * 16 : 9 + R() * 11, d = 8 + R() * 8;
    const t = winTex.clone(); t.repeat.set(w / 16, h / 32); t.offset.set(R(), R());
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshBasicMaterial({ map: t, color: C('#b9a8c8') }));
    b.position.set(Math.sin(ang) * dist, RY - 14 + h / 2, ROOF_Z - Math.cos(ang) * dist); b.lookAt(0, b.position.y, ROOF_Z);
    scene.add(b);
  }

  // the bar on the left: a counter glowing violet-pink, bottles lit on the back wall
  const barZ0 = ROOF_Z - 3.2, barZ1 = ROOF_Z - 10.5, barX = -6.2;
  const front = new THREE.Mesh(new THREE.PlaneGeometry(barZ0 - barZ1, 1.05), glow(C(PAL.b).lerp(C(VIOLET), 0.5).multiplyScalar(1.6), 0.4));
  front.rotation.y = Math.PI / 2; front.position.set(barX + 0.36, RY + 0.53, (barZ0 + barZ1) / 2); scene.add(front);
  const counter = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.06, barZ0 - barZ1 + 0.1), new THREE.MeshStandardMaterial({ color: C('#d9d2e6'), roughness: 0.25 }));
  counter.position.set(barX, RY + 1.08, (barZ0 + barZ1) / 2); scene.add(counter);
  const back = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.4, barZ0 - barZ1), new THREE.MeshStandardMaterial({ color: C('#1a1424'), roughness: 0.6 }));
  back.position.set(barX - 1.5, RY + 1.2, (barZ0 + barZ1) / 2); scene.add(back);
  const bottles = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.04, 0.045, 0.3, 8), glowMat(C('#ffb36b').multiplyScalar(1.6)), 40);
  for (let k = 0; k < 40; k++) bottles.setMatrixAt(k, m4.makeTranslation(barX - 1.3, RY + 1.3 + (k % 2) * 0.5, barZ0 - 0.2 - (k / 40) * (barZ0 - barZ1 - 0.4)));
  scene.add(bottles);
  const barLight = new THREE.PointLight(C(PAL.b), 18, 8, 2); barLight.position.set(barX + 1.2, RY + 0.5, (barZ0 + barZ1) / 2); scene.add(barLight);

  // DJ at the far end: the plank table from the photos, decks with blinking lights, two speakers
  const wood = new THREE.MeshStandardMaterial({ color: C('#4a3424'), roughness: 0.8 });
  const DJZ = ROOF_Z - 12.5;
  const plank = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.05, 0.7), wood); plank.position.set(0, RY + 1.0, DJZ); scene.add(plank);
  const deckBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.07, 0.45), new THREE.MeshStandardMaterial({ color: C('#0b0a0c'), roughness: 0.4 }));
  deckBox.position.set(0, RY + 1.06, DJZ); scene.add(deckBox);
  const leds: THREE.Mesh[] = [];
  for (let i = 0; i < 10; i++) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.01, 0.03), glow(C(i % 3 ? PAL.b : PAL.a).multiplyScalar(2.5))); l.position.set(-0.4 + i * 0.09, RY + 1.1, DJZ + 0.1); scene.add(l); leds.push(l); }
  scene.add(tube(new THREE.Vector3(-0.8, RY, DJZ), new THREE.Vector3(-0.8, RY + 1, DJZ), 0.03, wood), tube(new THREE.Vector3(0.8, RY, DJZ), new THREE.Vector3(0.8, RY + 1, DJZ), 0.03, wood));
  for (const sx of [-1.8, 1.8]) {
    const spk = new THREE.Mesh(new THREE.BoxGeometry(0.55, 1.3, 0.5), new THREE.MeshStandardMaterial({ color: C('#0c0b10'), roughness: 0.7 }));
    spk.position.set(sx, RY + 0.65, DJZ); scene.add(spk);
  }
  const dj = new THREE.Group();
  dj.add(new THREE.Mesh(new THREE.CapsuleGeometry(0.21, 0.75, 4, 10), new THREE.MeshStandardMaterial({ color: C('#16141c'), roughness: 0.8 })));
  const djHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), new THREE.MeshStandardMaterial({ color: C('#d8c2b6'), roughness: 0.7 })); djHead.position.y = 0.62; dj.add(djHead);
  dj.position.set(0, RY + 0.6, DJZ - 0.55); scene.add(dj);

  // the crowd: people standing and moving to the beat between the door and the DJ (kept clear of the walk-out path)
  const crowdN = 46, bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.2, 0.8, 4, 10), new THREE.MeshStandardMaterial({ roughness: 0.8 }), crowdN);
  const heads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.11, 12, 10), new THREE.MeshStandardMaterial({ roughness: 0.7 }), crowdN);
  const shoulders = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.075, 0.36, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), crowdN);
  const arms = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.045, 0.55, 4, 8), new THREE.MeshStandardMaterial({ roughness: 0.8 }), crowdN);
  const people: { x: number; z: number; h: number; ph: number; up: boolean }[] = [];
  const shirts = ['#141218', '#1d1a26', '#2a2236', '#d9d4e2', '#3a1d2e', '#101418', '#4a4458'], skin = ['#e0c3b0', '#b88a6e', '#7a5440', '#f0d6c4'];
  while (people.length < crowdN) {
    const x = (R() - 0.5) * 9, z = ROOF_Z - 4 - R() * 8;
    if (Math.abs(x) < 1.1 && z > ROOF_Z - 6) continue;              // keep the view from the door open
    if (x < barX + 1.4) continue;                                   // not inside the bar
    const pp = { x, z, h: 0.92 + R() * 0.2, ph: R() * 6, up: R() < 0.35 }; people.push(pp);
    const shirt = C(shirts[Math.floor(R() * shirts.length)]);
    bodies.setColorAt(people.length - 1, shirt); shoulders.setColorAt(people.length - 1, shirt); arms.setColorAt(people.length - 1, shirt);
    heads.setColorAt(people.length - 1, C(skin[Math.floor(R() * skin.length)]));
  }
  // pose one person: body, head, shoulders (a bar across), and for some an arm in the air
  const rotZ = new THREE.Matrix4().makeRotationZ(Math.PI / 2), mm = new THREE.Matrix4();
  const pose = (p: (typeof people)[number], i: number, bob: number, sway: number) => {
    bodies.setMatrixAt(i, mm.makeTranslation(p.x + sway, RY + 0.6 * p.h + bob, p.z).multiply(new THREE.Matrix4().makeScale(1, p.h, 1)));
    heads.setMatrixAt(i, mm.makeTranslation(p.x + sway * 1.3, RY + 1.33 * p.h + bob, p.z));
    shoulders.setMatrixAt(i, mm.makeTranslation(p.x + sway * 1.2, RY + 1.1 * p.h + bob, p.z).multiply(rotZ));
    const ay = p.up ? RY + 1.55 * p.h + bob * 2 : RY + 0.85 * p.h + bob;
    arms.setMatrixAt(i, mm.makeTranslation(p.x + sway * 1.4 + 0.22, ay, p.z).multiply(new THREE.Matrix4().makeRotationZ(p.up ? -0.25 : 0.12)));
  };
  people.forEach((p, i) => pose(p, i, 0, 0)); // start in place (they only animate once you're on the roof)
  scene.add(bodies, heads, shoulders, arms);
  const crowdLights = [new THREE.PointLight(C(VIOLET), 22, 10, 2), new THREE.PointLight(C(PAL.b), 14, 9, 2), new THREE.PointLight(C('#3d6bff'), 14, 10, 2)];
  crowdLights[0].position.set(-2, RY + 0.4, ROOF_Z - 7); crowdLights[1].position.set(2.5, RY + 2.5, ROOF_Z - 9); crowdLights[2].position.set(0, RY + 3, DJZ - 1);
  crowdLights.forEach((l) => scene.add(l));

  // festoon lights over the crowd
  const bulbs = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), glow(C(PAL.a).lerp(C(PAL.fg), 0.3).multiplyScalar(2.6)), 3 * 18);
  let bi = 0;
  for (const z of [ROOF_Z - 4.5, ROOF_Z - 7.5, ROOF_Z - 10.5]) {
    const pts: THREE.Vector3[] = [];
    for (let k = 0; k <= 18; k++) { const u = k / 18, x = lerp(-6, 7, u); pts.push(new THREE.Vector3(x, RY + 3.6 - Math.sin(u * Math.PI) * 0.8, z)); }
    scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: C('#050305') })));
    for (let k = 1; k < 19 && bi < bulbs.count; k++) bulbs.setMatrixAt(bi++, m4.makeTranslation(pts[k - 1].x, pts[k - 1].y - 0.08, z));
  }
  scene.add(bulbs);
  // smoke drifting from the booth
  const puffTex = puff(), smoke: { s: THREE.Sprite; ph: number; x: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: puffTex, color: C(PAL.fg), transparent: true, opacity: 0.16, depthWrite: false }));
    scene.add(sp); smoke.push({ s: sp, ph: i / 12, x: (R() - 0.5) * 2.5 });
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
    for (const s of stairLights) s.l.intensity = s.base * (0.55 + 0.45 * kick);
    const flicker = Math.sin(t * 13) > 0.94 ? 0.35 : 1;
    signLight.intensity = 14 * k * flicker; signCore.visible = flicker > 0.5;
    leak.intensity = 0.5 * k;
    leds.forEach((l, i) => (l.visible = Math.sin(t * 8 + i * 1.7) > -0.2));
    if (camera.position.z < ROOF_Z + 3) { // the crowd moves only when you can see it
      people.forEach((p, i) => pose(p, i, Math.max(0, Math.sin(t * 6.6 + p.ph)) * 0.05 * (0.4 + kick), Math.sin(t * 1.7 + p.ph) * 0.04));
      for (const im of [bodies, heads, shoulders, arms]) im.instanceMatrix.needsUpdate = true;
      dj.position.y = RY + 0.6 + Math.max(0, Math.sin(t * 6.6)) * 0.03;
    }
    for (const m of smoke) {
      const life = (t * 0.07 + m.ph) % 1;
      m.s.position.set(m.x + Math.sin(t * 0.4 + m.ph * 6) * 0.6, RY + 1.2 + life * 4, DJZ - 0.3 - life * 1.5);
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
      // straight out of the door, then a look left at the bar, then across the crowd to the DJ
      const lx = l < 0.3 ? 0 : l < 0.45 ? lerp(0, -4.2, ease((l - 0.3) / 0.15)) : lerp(-4.2, 1.2, ease(clamp((l - 0.45) / 0.4)));
      look.set(lx + Math.sin(t * 0.3) * 0.2, TOP_Y + lerp(1.6, 1.8, k), z - 10);
    }
    return { pos, look };
  }

  return { scene, ready, streetDoor: streetLeaf, roofDoor: roofLeaf, setDoors, update, reflect, cameraAt };
}
