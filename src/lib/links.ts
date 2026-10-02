import type { PresentsEvent } from '../content/floors.ts';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

export const mailtoHref = (email: string, subject: string) => `mailto:${email}?subject=${encodeURIComponent(subject)}`;
export const whatsappHref = (num: string, text: string) => `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export const instagramHref = (h: string) => `https://instagram.com/${h.replace(/^@/, '')}`;
export const soundcloudEmbed = (url: string) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff2bd6&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`;

export function eventLabel(e: PresentsEvent | null): string {
  if (!e) return 'NEXT EVENT SOON';
  const [y, m, d] = e.date.split('-').map(Number);
  return `NEXT: ${d} ${MONTHS[m - 1]} ${y}`;
}
