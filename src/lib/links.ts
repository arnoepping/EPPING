export const mailtoHref = (email: string, subject: string, body = '') =>
  `mailto:${email}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;
export const whatsappHref = (num: string, text: string) => `https://wa.me/${num.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
export const soundcloudEmbed = (url: string) =>
  `https://w.soundcloud.com/player/?url=${encodeURIComponent(url)}&color=%23ff2bd6&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&visual=false`;
