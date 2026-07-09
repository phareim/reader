/**
 * Password policy for sign-up (and future password changes).
 * Length does most of the work (NIST-style); the letter+digit floor keeps
 * out twelve spaces and phone numbers. Sign-IN never validates — existing
 * passwords are grandfathered.
 */

export const PASSWORD_MIN_LENGTH = 12

export const PASSWORD_HINT = `At least ${PASSWORD_MIN_LENGTH} characters, with a letter and a digit`

export type PasswordCheck = { ok: true } | { ok: false; reason: string }

export function checkPassword(password: unknown): PasswordCheck {
  if (typeof password !== 'string') {
    return { ok: false, reason: 'Password is required' }
  }
  if (password.length < PASSWORD_MIN_LENGTH) {
    return { ok: false, reason: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` }
  }
  if (!/\p{L}/u.test(password)) {
    return { ok: false, reason: 'Password must contain a letter' }
  }
  if (!/\d/.test(password)) {
    return { ok: false, reason: 'Password must contain a digit' }
  }
  return { ok: true }
}
