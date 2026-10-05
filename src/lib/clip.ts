// Floor-page clips loop muted; the "Play sound" button unmutes (restarting the clip) or mutes again.
export function toggleClip(b: HTMLElement) {
  const v = b.parentElement?.querySelector('video');
  if (!v) return;
  v.muted = !v.muted;
  if (!v.muted) { v.currentTime = 0; v.play().catch(() => {}); }
  b.setAttribute('aria-pressed', String(!v.muted));
}
