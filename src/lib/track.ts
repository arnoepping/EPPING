// Umami Cloud (cookie-free). Website ID is public; empty = analytics off.
export const UMAMI_ID = '9f8f9190-72be-4fed-b449-ead839472f42';

declare global { interface Window { umami?: { track: (name: string, data?: Record<string, string>) => void } } }

export function track(name: string, data?: Record<string, string>) {
  try { window.umami?.track(name, data); } catch { /* blocked or not loaded */ }
}
