export class InputError extends Error {}

export function safeReturnPath(value: string | null | undefined, fallback = '/') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u001f]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://journal.invalid');
    return url.origin === 'https://journal.invalid' ? url.pathname + url.search + url.hash : fallback;
  } catch { return fallback; }
}

export function validOrigin(request: Request) {
  const origin = request.headers.get('origin');
  return !!origin && origin === new URL(request.url).origin;
}

export function imageUrl(value: unknown) {
  if (typeof value !== 'string' || value.length > 3000) throw new InputError('Use a valid image URL.');
  const input = value.trim();
  if (!input) return '';
  if (input.startsWith('/') && !input.startsWith('//') && !input.includes('\\')) return input;
  try {
    const url = new URL(input);
    if (['https:', 'http:'].includes(url.protocol) && !url.username && !url.password) return url.href;
  } catch { /* Report an input error below. */ }
  throw new InputError('Use an http or https image URL.');
}

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new InputError('Invalid request.');
  return value as Record<string, unknown>;
}

export function textField(value: unknown, label: string, max: number, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new InputError(`${label} must contain ${required ? '1' : '0'}–${max.toLocaleString()} characters.`);
  }
  return value.trim();
}
