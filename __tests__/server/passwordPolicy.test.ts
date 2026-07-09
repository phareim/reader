import { checkPassword, PASSWORD_MIN_LENGTH } from '../../server/utils/passwordPolicy'

describe('checkPassword', () => {
  it('accepts a long password with a letter and a digit', () => {
    expect(checkPassword('correct horse battery 9')).toEqual({ ok: true })
  })

  it('rejects non-strings', () => {
    expect(checkPassword(undefined).ok).toBe(false)
    expect(checkPassword(12345678901234 as any).ok).toBe(false)
  })

  it('rejects short passwords, including the old 8-char floor', () => {
    expect(checkPassword('abc12345').ok).toBe(false)
    expect(checkPassword('a1'.repeat(5)).ok).toBe(false) // 10 chars
    expect(checkPassword('a1'.repeat(6)).ok).toBe(true) // 12 chars
  })

  it('rejects all-digit and all-letter passwords', () => {
    expect(checkPassword('123456789012345').ok).toBe(false)
    expect(checkPassword('justlettershere').ok).toBe(false)
  })

  it('counts unicode letters as letters', () => {
    expect(checkPassword('blåbærsyltetøy9').ok).toBe(true)
  })

  it('exports the floor the UI hint references', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(12)
  })
})
