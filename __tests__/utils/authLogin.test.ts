import { authLoginUrl, handsOverLogin } from '~/utils/authLogin'

const R = 'https://reader.phareim.no'
const decoded = (u: string) => decodeURIComponent(u.split('redirect=')[1])

describe('authLoginUrl', () => {
  it('sends a Reader path back to Reader', () => {
    expect(decoded(authLoginUrl('/shelf?x=1', R))).toBe('https://reader.phareim.no/shelf?x=1')
  })
  it('keeps a sibling app on *.phareim.no', () => {
    expect(decoded(authLoginUrl('https://do.phareim.no/today', R))).toBe('https://do.phareim.no/today')
  })
  it('falls back to Reader home for foreign, protocol-relative or empty targets', () => {
    for (const bad of ['https://evil.example/', '//evil.example', 'http://do.phareim.no/', 'nonsense', '', undefined]) {
      expect(decoded(authLoginUrl(bad, R))).toBe('https://reader.phareim.no/')
    }
  })
  it('points at auth.phareim.no', () => {
    expect(authLoginUrl('/', R).startsWith('https://auth.phareim.no/?redirect=')).toBe(true)
  })
})

describe('handsOverLogin', () => {
  it('only on the production host', () => {
    expect(handsOverLogin('reader.phareim.no')).toBe(true)
    expect(handsOverLogin('localhost')).toBe(false)
  })
})
