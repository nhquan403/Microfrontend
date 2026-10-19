/**
 * Accepts only same-origin relative paths as post-login destinations, preventing open
 * redirects. Anything else (absolute URLs, protocol-relative `//host`, backslash tricks,
 * auth endpoints) falls back to `/`.
 */
export function safeReturnTo(raw: unknown, publicOrigin: string): string {
  if (
    typeof raw !== 'string' ||
    !raw.startsWith('/') ||
    raw.startsWith('//') ||
    raw.includes('\\')
  ) {
    return '/';
  }
  let url: URL;
  try {
    url = new URL(raw, publicOrigin);
  } catch {
    return '/';
  }
  if (url.origin !== publicOrigin || url.pathname.startsWith('/auth/')) {
    return '/';
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
