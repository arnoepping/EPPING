/** 1 on each beat, exponential decay until the next. t in seconds. */
export function pulse(t: number, bpm: number): number {
  const phase = ((t * bpm) / 60) % 1;
  return Math.exp(-phase * 6);
}
