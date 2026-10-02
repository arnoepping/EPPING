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

export function cameraTarget(s: RigState): { pos: Vec3; look: Vec3 } {
  if (s.mode === 'tunnel') {
    const z = -s.progress * TUNNEL_LEN;
    return { pos: [0, 0, z], look: [0, 0, z - 10] };
  }
  const x = FLOOR_X[s.mode === 'floor' && s.active !== null ? s.active : s.focus];
  return s.mode === 'hall'
    ? { pos: [x, 7, HALL_Z + 26], look: [x, 1, HALL_Z] }
    : { pos: [x, 3.5, HALL_Z + 11], look: [x, 0.5, HALL_Z] };
}
