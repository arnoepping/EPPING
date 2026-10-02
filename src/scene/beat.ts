/** 1 on each beat, exponential decay until the next. t in seconds. */
export function pulse(t: number, bpm: number): number {
  const x = (t * bpm) / 60;
  const phase = x - Math.floor(x);
  return Math.exp(-phase * 6);
}
