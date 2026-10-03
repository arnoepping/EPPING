// Scene colours. Sunset rave is live; swap PAL for GOLD_RUSH (or another lab palette) to recolour the 3D world.
export interface Palette { bg: string; fg: string; a: string; b: string }
export const SUNSET_RAVE: Palette = { bg: '#12061A', fg: '#FFF4E8', a: '#FF4D00', b: '#FF2BD6' };
export const GOLD_RUSH: Palette = { bg: '#0A0A0A', fg: '#FFF8E1', a: '#FFC400', b: '#FF3D7F' };
export const PAL: Palette = SUNSET_RAVE;
