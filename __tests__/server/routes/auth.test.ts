/** @jest-environment node */
/**
 * Contract tests for the login seam. Every other *.phareim.no app signs its
 * visitors in through these routes and then validates the `session_token`
 * cookie against the shared `session` / `User` tables, so the response
 * shapes, status codes, cookie attributes and the rows written are pinned
 * here. D1 is a hand-written fake.
 */
import {
  fakeD1, makeEvent, callHandler, setCookies, authAs, SESSION_COOKIE, MCP_HEADER,
  type D1Call,
} from '~/__tests__/mocks/nitro'
import signIn from '~/server/api/auth/sign-in.post'
import signUp from '~/server/api/auth/sign-up.post'
import signOut from '~/server/api/auth/sign-out.post'
import sessionGet from '~/server/api/auth/session.get'
import mcpTest from '~/server/api/mcp/test.get'
import { hashPassword } from '~/server/utils/password'

const PASSWORD = 'correct horse 42'
const userRow = async () => ({
  id: 'user-1',
  email: 'petter@example.com',
  name: 'Petter',
  image: null,
  password_hash: await hashPassword(PASSWORD),
  mcp_token: 'secret-mcp-token',
  created_at: '2026-01-01 00:00:00',
})

/** The fake's answers for sign-in/sign-up: one known user, a failure counter. */
const authDb = (user: Record<string, any> | null, opts: { failures?: number } = {}) =>
  fakeD1((call: D1Call) => {
    if (/COUNT\(\*\) AS n FROM "auth_attempt"/.test(call.sql)) return { n: opts.failures ?? 0 }
    if (/FROM "User" WHERE email = \?/.test(call.sql)) return user && call.binds[0] === user.email ? user : null
    if (/FROM "User" WHERE lower\(email\) = lower\(\?\)/.test(call.sql)) {
      return user && String(call.binds[0]).toLowerCase() === user.email.toLowerCase() ? { id: user.id } : null
    }
  })

const post = (handler: any, db: ReturnType<typeof fakeD1>, body: unknown, extra: Record<string, any> = {}) => {
  const event = makeEvent({ method: 'POST', body, db, ...extra })
  return callHandler(handler, event).then((result) => ({ ...result, event }))
}

describe('POST /api/auth/sign-in', () => {
  it('answers { user } with the public fields only and opens a 30-day session', async () => {
    const user = await userRow()
    const db = authDb(user)

    const { status, body, event } = await post(signIn, db, { email: user.email, password: PASSWORD })

    expect(status).toBe(200)
    expect(body).toEqual({ user: { id: 'user-1', email: 'petter@example.com', name: 'Petter', image: null } })

    // The session row the sibling apps read: (id, user_id, token, expires_at).
    const insert = db.matching(/INSERT INTO "session" \(id, user_id, token, expires_at\)/)[0]
    const [id, userId, token, expiresAt] = insert.binds
    expect(id).toMatch(/^[0-9a-f]{24}$/)
    expect(userId).toBe('user-1')
    expect(token).toMatch(/^[0-9a-f]{64}$/)
    const days = (Date.parse(expiresAt) - Date.now()) / 86_400_000
    expect(days).toBeGreaterThan(29.9)
    expect(days).toBeLessThan(30.1)

    // The cookie carries that token: HttpOnly, Lax, whole-site, 30 days.
    const [cookie] = setCookies(event)
    expect(cookie).toContain(`session_token=${token}`)
    expect(cookie).toContain('Max-Age=2592000')
    expect(cookie).toContain('Path=/')
    expect(cookie).toContain('HttpOnly')
    expect(cookie).toContain('SameSite=Lax')
    expect(cookie).not.toContain('Domain=')

    // A success clears the caller's failure window.
    expect(db.matching(/DELETE FROM "auth_attempt" WHERE email = \?/)[0].binds).toEqual(['petter@example.com'])
  })

  it('sets the cookie for every *.phareim.no app in production', async () => {
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const user = await userRow()
      const { event } = await post(signIn, authDb(user), { email: user.email, password: PASSWORD })
      const [cookie] = setCookies(event)
      expect(cookie).toContain('Domain=.phareim.no')
      expect(cookie).toContain('Secure')
    } finally {
      process.env.NODE_ENV = before
    }
  })

  it('refuses a body that is not JSON with 415 before reading anything', async () => {
    const db = authDb(await userRow())
    const { status } = await post(signIn, db, 'email=a&password=b', {
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
    })
    expect(status).toBe(415)
    expect(db.calls).toHaveLength(0)
  })

  it('answers 400 when email or password is missing', async () => {
    expect((await post(signIn, authDb(null), { email: 'a@b.no' })).status).toBe(400)
    expect((await post(signIn, authDb(null), {})).status).toBe(400)
  })

  it('answers the same 401 for an unknown email and a wrong password, and records the attempt', async () => {
    const user = await userRow()

    const unknownDb = authDb(user)
    const unknown = await post(signIn, unknownDb, { email: 'Nobody@Example.com', password: PASSWORD })
    const wrongDb = authDb(user)
    const wrong = await post(signIn, wrongDb, { email: user.email, password: 'not the password 1' })

    expect(unknown.status).toBe(401)
    expect(wrong.status).toBe(401)
    expect(unknown.statusMessage).toBe(wrong.statusMessage)
    expect(setCookies(unknown.event)).toHaveLength(0)
    expect(setCookies(wrong.event)).toHaveLength(0)
    // Attempts are keyed on the lowercased target email.
    expect(unknownDb.matching(/INSERT INTO "auth_attempt"/)[0].binds[0]).toBe('nobody@example.com')
    expect(wrongDb.matching(/INSERT INTO "auth_attempt"/)).toHaveLength(1)
    expect(wrongDb.matching(/INSERT INTO "session"/)).toHaveLength(0)
  })

  it('answers 400 for an email that is not a string, without touching D1', async () => {
    const db = authDb(await userRow())
    expect((await post(signIn, db, { email: { a: 1 }, password: PASSWORD })).status).toBe(400)
    expect((await post(signIn, db, { email: 123, password: PASSWORD })).status).toBe(400)
    expect(db.calls).toHaveLength(0)
  })

  it('trims the email before looking it up', async () => {
    const user = await userRow()
    const db = authDb(user)

    const { status } = await post(signIn, db, { email: `  ${user.email} `, password: PASSWORD })

    expect(status).toBe(200)
    expect(db.matching(/FROM "User" WHERE email = \?/)[0].binds).toEqual(['petter@example.com'])
  })

  it('answers 429 after ten failures in the window, even with the right password', async () => {
    const user = await userRow()
    const db = authDb(user, { failures: 10 })
    // h3 warns that this statusMessage holds a non-ASCII dash; not under test.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const { status } = await post(signIn, db, { email: user.email, password: PASSWORD })
    warn.mockRestore()

    expect(status).toBe(429)
    expect(db.matching(/INSERT INTO "session"/)).toHaveLength(0)
  })
})

describe('POST /api/auth/sign-up', () => {
  const config = { inviteCode: 'Ulrikke' }
  const fresh = { email: 'new@example.com', password: 'a new password 1', inviteCode: ' ulrikke ' }

  it('is closed (403) while no invite code is configured', async () => {
    const { status, statusMessage } = await post(signUp, authDb(null), fresh, { config: {} })
    expect(status).toBe(403)
    expect(statusMessage).toBe('Sign-ups are closed')
  })

  it('answers 403 for a wrong or missing invite code', async () => {
    expect((await post(signUp, authDb(null), { ...fresh, inviteCode: 'nope' }, { config })).status).toBe(403)
    expect((await post(signUp, authDb(null), { ...fresh, inviteCode: undefined }, { config })).status).toBe(403)
  })

  it('counts a wrong invite code as a failed attempt against that email', async () => {
    const db = authDb(null)

    const { status } = await post(signUp, db, { ...fresh, email: ' New@Example.com ', inviteCode: 'nope' }, { config })

    expect(status).toBe(403)
    expect(db.matching(/INSERT INTO "auth_attempt"/)[0].binds[0]).toBe('new@example.com')
  })

  it('answers 429 past the attempt limit, even with the right invite code', async () => {
    const db = authDb(null, { failures: 10 })
    // h3 warns that this statusMessage holds a non-ASCII dash; not under test.
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})

    const { status } = await post(signUp, db, fresh, { config })
    warn.mockRestore()

    expect(status).toBe(429)
    expect(db.matching(/INSERT INTO "User"/)).toHaveLength(0)
  })

  it('answers 400 for an email that is not a string', async () => {
    const db = authDb(null)
    const { status } = await post(signUp, db, { ...fresh, email: 123 }, { config })
    expect(status).toBe(400)
    expect(db.calls).toHaveLength(0)
  })

  it('stores the email trimmed and matches case variants on the trimmed form', async () => {
    const db = authDb(null)
    const { status, body } = await post(signUp, db, { ...fresh, email: '  new@example.com ' }, { config })
    expect(status).toBe(200)
    expect(body.user.email).toBe('new@example.com')
    expect(db.matching(/INSERT INTO "User"/)[0].binds[2]).toBe('new@example.com')

    const variant = await post(signUp, authDb(await userRow()), { ...fresh, email: ' Petter@Example.com ' }, { config })
    expect(variant.status).toBe(409)
  })

  it('enforces the password policy with 400', async () => {
    const { status } = await post(signUp, authDb(null), { ...fresh, password: 'short1' }, { config })
    expect(status).toBe(400)
  })

  it('creates the user and a session, matching the invite code case-insensitively', async () => {
    const db = authDb(null)

    const { status, body, event } = await post(signUp, db, fresh, { config })

    expect(status).toBe(200)
    expect(body.user).toMatchObject({ email: 'new@example.com', name: 'new', image: null })
    const insert = db.matching(/INSERT INTO "User" \(id, name, email, password_hash\)/)[0]
    expect(insert.binds[0]).toBe(body.user.id)
    expect(insert.binds[2]).toBe('new@example.com')
    expect(insert.binds[3]).toMatch(/^[0-9a-f]{32}:[0-9a-f]{64}$/)
    expect(db.matching(/INSERT INTO "session"/)[0].binds[1]).toBe(body.user.id)
    expect(setCookies(event)[0]).toContain('session_token=')
  })

  it('answers 409 for an existing account and for a case variant of its email', async () => {
    const user = await userRow()

    const same = await post(signUp, authDb(user), { ...fresh, email: user.email }, { config })
    const variant = await post(signUp, authDb(user), { ...fresh, email: 'Petter@Example.com' }, { config })

    expect(same.status).toBe(409)
    expect(variant.status).toBe(409)
  })

  it('lets a password-less legacy account claim its password with the invite code', async () => {
    const legacy = { ...(await userRow()), password_hash: null }
    const db = authDb(legacy)

    const { status, body } = await post(signUp, db, { ...fresh, email: legacy.email }, { config })

    expect(status).toBe(200)
    expect(body.user.id).toBe('user-1')
    expect(db.matching(/UPDATE "User" SET password_hash = \? WHERE id = \?/)[0].binds[1]).toBe('user-1')
    expect(db.matching(/INSERT INTO "User"/)).toHaveLength(0)
  })
})

describe('GET /api/auth/session', () => {
  it('answers { user: null } without a cookie and without touching D1', async () => {
    const db = fakeD1()
    const { status, body } = await callHandler(sessionGet, makeEvent({ db }))
    expect(status).toBe(200)
    expect(body).toEqual({ user: null })
    expect(db.calls).toHaveLength(0)
  })

  it('answers the public user and the personal flag for a live session, re-setting the cookie', async () => {
    const user = await userRow()
    const db = fakeD1(authAs(user))
    const event = makeEvent({ headers: SESSION_COOKIE, db, config: { personalEmails: 'someone@else.no, PETTER@example.com' } })

    const { body } = await callHandler(sessionGet, event)

    expect(body).toEqual({
      user: { id: 'user-1', email: 'petter@example.com', name: 'Petter', image: null },
      features: { personal: true },
    })
    // Looked up by token, unexpired only.
    const lookup = db.matching(/FROM "session" s JOIN "User" u ON u\.id = s\.user_id WHERE s\.token = \? AND s\.expires_at > \?/)[0]
    expect(lookup.binds[0]).toBe('test-session-token')
    expect(setCookies(event)[0]).toContain('session_token=test-session-token')
  })

  it('marks an account outside the allowlist as not personal', async () => {
    const db = fakeD1(authAs(await userRow()))
    const { body } = await callHandler(sessionGet, makeEvent({ headers: SESSION_COOKIE, db, config: { personalEmails: 'other@example.com' } }))
    expect(body.features).toEqual({ personal: false })
  })

  it('answers { user: null } for an unknown or expired token and clears the expired row', async () => {
    const db = fakeD1(authAs(null))
    const event = makeEvent({ headers: SESSION_COOKIE, db })

    const { body } = await callHandler(sessionGet, event)

    expect(body).toEqual({ user: null })
    expect(db.matching(/DELETE FROM "session" WHERE token = \? AND expires_at <= \?/)[0].binds[0]).toBe('test-session-token')
    expect(setCookies(event)).toHaveLength(0)
  })
})

describe('POST /api/auth/sign-out', () => {
  it('deletes the session row and expires the cookie', async () => {
    const db = fakeD1()
    const event = makeEvent({ method: 'POST', headers: SESSION_COOKIE, db })

    const { body } = await callHandler(signOut, event)

    expect(body).toEqual({ success: true })
    expect(db.matching(/DELETE FROM "session" WHERE token = \?/)[0].binds).toEqual(['test-session-token'])
    const cookies = setCookies(event)
    expect(cookies.length).toBeGreaterThan(0)
    for (const cookie of cookies) {
      expect(cookie).toMatch(/^session_token=;/)
      expect(cookie).toContain('Max-Age=0')
    }
  })
})

describe('MCP token auth (X-MCP-Token)', () => {
  it('resolves the user by User.mcp_token', async () => {
    const user = await userRow()
    const db = fakeD1(authAs(user))

    const { body } = await callHandler(mcpTest, makeEvent({ headers: MCP_HEADER, db }))

    expect(body).toEqual({
      success: true,
      message: 'MCP connection successful',
      user: { id: 'user-1', email: 'petter@example.com', name: 'Petter' },
    })
    const lookup = db.matching(/FROM "User" WHERE mcp_token = \?/)[0]
    expect(lookup.binds).toEqual(['test-mcp-token'])
  })

  it('does not fall back to the session cookie when the token is wrong', async () => {
    const user = await userRow()
    const db = fakeD1((call) => (/FROM "session" s JOIN "User" u/.test(call.sql) ? user : null))

    const { body } = await callHandler(mcpTest, makeEvent({ headers: { ...MCP_HEADER, ...SESSION_COOKIE }, db }))

    expect(body.success).toBe(false)
    expect(db.matching(/FROM "session"/)).toHaveLength(0)
  })
})
