export const socialFields = [
  ['instagram', 'Instagram', 'https://instagram.com/yourname'],
  ['linkedin', 'LinkedIn', 'https://linkedin.com/in/yourname'],
  ['twitter', 'X / Twitter', 'https://x.com/yourname'],
  ['github', 'GitHub', 'https://github.com/yourname'],
  ['substack', 'Substack', 'https://yourname.substack.com'],
  ['website', 'Other website', 'https://yourwebsite.com'],
] as const;
export const themes = [
  ['parchment', 'Parchment', 'An old-world reading room'],
  ['forest', 'Forest Green', 'Deep green, warm ivory & brass'],
  ['burgundy', 'Burgundy', 'Oxblood, aged gold & soft cream'],
  ['night', 'Midnight', 'Charcoal, candlelight & quiet'],
  ['ivory', 'Ivory', 'A clean, sunlit page'],
] as const;
export function socialUrl(value: string): string | null {
  if (!value.trim()) return '';
  try {
    const raw = value.trim();
    const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : 'https://' + raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || !url.hostname.includes('.')) return null;
    return url.href;
  } catch { return null; }
}
