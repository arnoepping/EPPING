export function slugFromPath(path: string, slugs: readonly string[]): string | null {
  const parts = path.split('/').filter((p) => p && p !== 'index.html');
  const last = parts.at(-1);
  return last && slugs.includes(last) ? last : null;
}

export const pathForSlug = (slug: string | null, base = '/'): string => (slug ? `${base}${slug}/` : base);
