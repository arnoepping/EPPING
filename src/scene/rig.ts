import { TUNNEL_LEN, HALL_Z, FLOOR_X } from './layout.ts';

export type Mode = 'tunnel' | 'hall' | 'floor';
export interface RigState { mode: Mode; progress: number; focus: number; active: number | null }
export type Vec3 = [number, number, number];

const LAST = FLOOR_X.length - 1;
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

export function initialState(activeIndex: number | null): RigState {
  if (activeIndex === null) {
    return { mode: 'tunnel', progress: 0, focus: 1, active: null };
  }
  const clamped = clamp(Math.round(activeIndex), 0, LAST);
  return { mode: 'floor', progress: 1, focus: clamped, active: clamped };
}

/** Tunnel length = 3 viewport heights of scrolling. */
export function scrollBy(s: RigState, deltaPx: number, viewportH: number): RigState {
  if (s.mode !== 'tunnel' || viewportH <= 0) return s;
  const progress = clamp(s.progress + deltaPx / (3 * viewportH), 0, 1);
  return { ...s, progress, mode: progress >= 1 ? 'hall' : 'tunnel' };
}
export const skip = (s: RigState): RigState => (s.mode === 'tunnel' ? { ...s, mode: 'hall', progress: 1 } : s);
export const step = (s: RigState, dir: -1 | 1): RigState => (s.mode === 'hall' ? { ...s, focus: clamp(s.focus + dir, 0, LAST) } : s);
export const enter = (s: RigState, i: number = s.focus): RigState => {
  const clamped = clamp(Math.round(i), 0, LAST);
  return { mode: 'floor', progress: 1, focus: clamped, active: clamped };
};
export const leave = (s: RigState): RigState => (s.mode === 'floor' ? { ...s, mode: 'hall', active: null } : s);

/** Swipe left (negative dx) = next floor. */
export function swipeDir(dx: number, dy: number, threshold = 40): -1 | 0 | 1 {
  if (Math.abs(dx) < threshold || Math.abs(dx) < Math.abs(dy)) return 0;
  return dx < 0 ? 1 : -1;
}

/**
 * What the camera has to frame around: viewport aspect, tan(vertical fov / 2), and the share of the
 * viewport covered by UI on the right (desktop sheet) and at the bottom (phone sheet, hall bar).
 */
export interface View { aspect: number; tanV: number; right: number; bottom: number }
export const DEFAULT_VIEW: View = { aspect: 1.6, tanV: Math.tan((31 * Math.PI) / 180), right: 0, bottom: 0 };

/**
 * Camera that fits a w×h box (centered on `c`) into the uncovered part of the viewport.
 * The camera sits straight in front of the box (`lift` above it); the look point is shifted so the
 * box lands in the middle of the free area instead of the middle of the screen.
 */
function frame(c: Vec3, w: number, h: number, v: View, lift: number, depth = 0): { pos: Vec3; look: Vec3 } {
  const tanH = v.tanV * v.aspect;
  const fx = 1 - v.right, fy = 1 - v.bottom;
  // `depth`: how far the box reaches toward the camera; fit at its front so near parts don't overflow.
  const d = Math.max(w / (2 * tanH * fx), h / (2 * v.tanV * fy)) + depth;
  const cx = -v.right, cy = v.bottom; // free-area center in NDC
  return {
    pos: [c[0], c[1] + lift, c[2] + d],
    look: [c[0] - cx * tanH * d, c[1] + lift * 0.5 - cy * v.tanV * d, c[2]],
  };
}

const FLOOR_BOX = { y: 4.2, w: 14, h: 13, depth: 6.4 }; // platform ring to label top, with a margin

export function cameraTarget(s: RigState, view: View = DEFAULT_VIEW): { pos: Vec3; look: Vec3 } {
  if (s.mode === 'tunnel') {
    const z = -s.progress * TUNNEL_LEN;
    return { pos: [0, 0, z], look: [0, 0, z - 10] };
  }
  const x = FLOOR_X[s.mode === 'floor' && s.active !== null ? s.active : s.focus];
  const c: Vec3 = [x, FLOOR_BOX.y, HALL_Z];
  if (s.mode === 'floor') return frame(c, FLOOR_BOX.w, FLOOR_BOX.h, view, 2, FLOOR_BOX.depth);
  // Hall: landscape shows all three floors; portrait shows the focused one plus a hint of its neighbours.
  const w = view.aspect >= 1 ? FLOOR_X[LAST] - FLOOR_X[0] + 16 : FLOOR_BOX.w + 4;
  return frame(c, w, FLOOR_BOX.h + 2, view, 4);
}
