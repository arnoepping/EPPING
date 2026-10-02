import { soundcloudEmbed } from '../lib/links.ts';

/** Create the SoundCloud iframe once, replacing the fallback link. */
export function mountPlayer(panel: HTMLElement): void {
  const box = panel.querySelector<HTMLElement>('.player');
  if (!box || box.querySelector('iframe') || !panel.dataset.sc) return;
  const f = document.createElement('iframe');
  f.title = `SoundCloud: ${panel.dataset.slug}`;
  f.allow = 'autoplay';
  f.loading = 'lazy';
  f.src = soundcloudEmbed(panel.dataset.sc);
  box.replaceChildren(f);
}

export function setOpen(root: HTMLElement, slug: string | null): void {
  for (const p of root.querySelectorAll<HTMLElement>('.panel')) {
    const open = p.dataset.slug === slug;
    p.toggleAttribute('data-open', open);
    if (open) mountPlayer(p);
  }
}
