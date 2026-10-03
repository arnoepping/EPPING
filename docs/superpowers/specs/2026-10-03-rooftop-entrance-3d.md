# Rooftop entrance in three.js (replaces tunnel + hall)

Source of truth: the canvas mockup in `mockups/rooftop/` (private preview https://claude.ai/artifact/WDr3pafFf7zjuLDPAdGkAT). The old tunnel/hall site is removed.

## Story (one continuous 3D world, one camera path)
1. **Street:** realistic brick facade (procedural brick texture + bump), pavement, black door, EPPING G3 neon sign above it (emissive + bloom, flicker), velvet rope on posts. The camera *walks* to the door: real perspective, pavement passing below, rope passing by, slight head bob. Click the door or scroll.
2. **Stairwell:** door swings open; steep stairs (~43°) between brick walls; neon strips on the ceiling edges and step noses, neon handrail, glass light panels along the whole ceiling; colour runs pink → orange along the climb and pulses with the kick. Six cover posters (real perspective), hung high (~1.9 m above the steps). Click the roof door or scroll.
3. **Roof:** scrolling locks; autoplay: dusk sky, Amsterdam skyline, festoon lights, DJ table, smoke; then the dusk clip fades in with the logo + three floor buttons (none preselected) + "back to the street".
4. **Floor pages:** black, readable, video paused; copy from `src/content/floors.ts`; SoundCloud embed (real iframe on the site); WhatsApp + email (mailto) + copy; Instagram/SoundCloud links. Also as routes `/rave-wedding/`, `/private-events/`, `/presents/` for sharing/SEO.

## Sound
One song (Mau P – Just A Little Bit More) through a low-pass: bass only outside, opening while climbing, full on the roof. Off by default; `navigator.audioSession.type = 'playback'` for iPhone. Analyser drives the neon pulse.

## Palette
Sunset rave (bg #12061A, fg #FFF4E8, a #FF4D00, b #FF2BD6). Kept as one object in code so Gold rush (or another) can be swapped in later.

## Keep from the mockup
"Scroll to get in" hint bottom-right, sound toggle, small skip, replay. Not: stage counter, progress bar, palette switch.

## Fallback
No WebGL or reduced motion: static page (logo, tagline, floor links, contact).

## Media and rights
Video, song and covers are git-ignored for now (repo is public). Before going live: decide on music rights and whether the footage/covers may be public.
