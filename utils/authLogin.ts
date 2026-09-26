/**
 * Sign-in happens on auth.phareim.no, which forwards to this Worker's
 * /api/auth/* through a service binding. Reader's /login only hands the
 * visitor over, turning an app-local `redirect` into an absolute URL on
 * Reader so auth can send them back. `/login?direct=1` keeps the local form.
 */

export const AUTH_ORIGIN = 'https://auth.phareim.no'

export function authLoginUrl(redirect: unknown, readerOrigin: string): string {
  let target = `${readerOrigin}/`
  if (typeof redirect === 'string' && redirect !== '') {
    if (redirect.startsWith('/') && !redirect.startsWith('//')) {
      target = readerOrigin + redirect
    } else {
      try {
        const url = new URL(redirect)
        if (url.protocol === 'https:' && (url.hostname === 'phareim.no' || url.hostname.endsWith('.phareim.no'))) {
          target = url.href
        }
      } catch {
        // Not a URL: fall back to Reader's home.
      }
    }
  }
  return `${AUTH_ORIGIN}/?redirect=${encodeURIComponent(target)}`
}

/** Hand over only in production on Reader's own host, never in dev. */
export function handsOverLogin(hostname: string): boolean {
  return hostname === 'reader.phareim.no'
}
