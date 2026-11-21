/**
 * Minimal Nitro stand-in for route-handler tests.
 *
 * Route files rely on Nitro's auto-imports (`defineEventHandler`,
 * `createError`, `readBody`, `useRuntimeConfig`, …), which do not exist under
 * Jest. Importing this module installs the real h3 implementations as globals,
 * so a handler runs against a real H3Event built on Node's own request and
 * response objects. D1 and R2 are hand-written fakes; nothing here touches a
 * network or a live service.
 *
 * Import this module BEFORE the route file under test.
 */
import { IncomingMessage, ServerResponse } from 'node:http'
import { Socket } from 'node:net'
import * as h3 from 'h3'

const AUTO_IMPORTS = [
  'defineEventHandler', 'createError', 'readBody', 'getRouterParam', 'getQuery',
  'getHeader', 'getRequestHeader', 'setHeader', 'setResponseHeader', 'getRequestURL',
  'sendRedirect', 'getCookie', 'setCookie', 'deleteCookie',
] as const

for (const name of AUTO_IMPORTS) {
  ;(globalThis as any)[name] = (h3 as any)[name]
}
;(globalThis as any).useRuntimeConfig = (event?: any) => event?.context?.__config ?? {}

/** D1 rejects a statement with more than 100 bound parameters. */
export const D1_MAX_BOUND_PARAMS = 100

export interface D1Call {
  sql: string
  binds: any[]
  method: 'run' | 'first' | 'all'
}

/**
 * The value a fake statement resolves to:
 * - `run`   → `{ meta: { changes, last_row_id } }` (or anything shaped like it)
 * - `first` → a row object or null
 * - `all`   → an array of rows (wrapped as `{ results }`), or `{ results }`
 * Return `undefined` for the defaults: no row, no rows, zero changes.
 * Throw to simulate a failing statement.
 */
export type D1Responder = (call: D1Call) => any

export function fakeD1(respond: D1Responder = () => undefined) {
  const calls: D1Call[] = []

  const exec = async (sql: string, binds: any[], method: D1Call['method']) => {
    const call = { sql, binds, method }
    calls.push(call)
    if (binds.length > D1_MAX_BOUND_PARAMS) {
      throw new Error('D1_ERROR: too many SQL variables')
    }
    const out = await respond(call)
    if (method === 'first') return out ?? null
    if (method === 'all') return Array.isArray(out) ? { results: out } : (out ?? { results: [] })
    return out ?? { meta: { changes: 0, last_row_id: 0 } }
  }

  const statement = (sql: string, binds: any[] = []) => ({
    bind: (...next: any[]) => statement(sql, next),
    run: () => exec(sql, binds, 'run'),
    first: () => exec(sql, binds, 'first'),
    all: () => exec(sql, binds, 'all'),
  })

  return {
    calls,
    prepare: (sql: string) => statement(sql.replace(/\s+/g, ' ').trim()),
    batch: (statements: Array<{ all: () => Promise<any> }>) => Promise.all(statements.map((s) => s.all())),
    /** Calls whose SQL matches, in order. */
    matching: (pattern: RegExp) => calls.filter((c) => pattern.test(c.sql)),
  }
}

/** In-memory R2 bucket: put/get/delete, with `get` returning `{ text() }`. */
export function fakeBucket(initial: Record<string, string> = {}) {
  const objects = new Map<string, string>(Object.entries(initial))
  const deletes: Array<string | string[]> = []
  return {
    objects,
    deletes,
    put: async (key: string, value: string) => { objects.set(key, value) },
    get: async (key: string) => (objects.has(key) ? { text: async () => objects.get(key)! } : null),
    delete: async (keys: string | string[]) => {
      deletes.push(keys)
      for (const key of Array.isArray(keys) ? keys : [keys]) objects.delete(key)
    },
  }
}

export interface FakeEventOptions {
  method?: string
  url?: string
  headers?: Record<string, string>
  /** Parsed JSON body; sent with `content-type: application/json` unless a header overrides it. */
  body?: unknown
  params?: Record<string, string>
  /** What `useRuntimeConfig(event)` returns. */
  config?: Record<string, any>
  db?: ReturnType<typeof fakeD1>
  bucket?: ReturnType<typeof fakeBucket>
}

export function makeEvent(opts: FakeEventOptions = {}) {
  const req = new IncomingMessage(new Socket())
  req.method = opts.method ?? 'GET'
  req.url = opts.url ?? '/'
  const headers: Record<string, string> = { host: 'reader.test' }
  if (opts.body !== undefined) headers['content-type'] = 'application/json'
  for (const [key, value] of Object.entries(opts.headers ?? {})) headers[key.toLowerCase()] = value
  req.headers = headers
  if (opts.body !== undefined) (req as any).body = opts.body

  const res = new ServerResponse(req)
  const event = h3.createEvent(req, res)
  event.context.params = opts.params ?? {}
  event.context.__config = opts.config ?? {}
  event.context.cloudflare = { env: { DB: opts.db, ARTICLE_BUCKET: opts.bucket } }
  return event
}

/** The Set-Cookie headers a handler wrote, as an array of raw strings. */
export function setCookies(event: any): string[] {
  const raw = event.node.res.getHeader('set-cookie')
  if (!raw) return []
  return Array.isArray(raw) ? raw.map(String) : [String(raw)]
}

/** Run a handler and capture a thrown h3 error's status instead of throwing. */
export async function callHandler(handler: (event: any) => any, event: any): Promise<{ status: number; body: any; statusMessage?: string }> {
  try {
    const body = await handler(event)
    return { status: event.node.res.statusCode, body }
  } catch (error: any) {
    if (!error?.statusCode) throw error
    return { status: error.statusCode, body: error.data, statusMessage: error.statusMessage }
  }
}

export interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: any
}

/**
 * Replace global fetch with a recorder. `respond` returns a Response (or
 * throws) for each call; unmatched calls fail the test loudly so no request
 * can ever reach a real host.
 */
export function mockFetch(respond: (call: FetchCall) => Response | Promise<Response> | undefined) {
  const calls: FetchCall[] = []
  const original = globalThis.fetch
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const headers: Record<string, string> = {}
    for (const [key, value] of Object.entries(init.headers ?? {})) headers[key.toLowerCase()] = String(value)
    let body: any = init.body
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { /* keep the raw string */ }
    }
    const call = { url: String(input), method: (init.method ?? 'GET').toUpperCase(), headers, body }
    calls.push(call)
    const response = await respond(call)
    if (!response) throw new Error(`Unexpected fetch in test: ${call.method} ${call.url}`)
    return response
  }) as any
  return { calls, restore: () => { globalThis.fetch = original } }
}

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/**
 * Wrap a responder so the session-cookie and MCP-token lookups resolve to
 * `user` (pass null for "not signed in"); every other statement goes to `rest`.
 */
export const authAs = (user: Record<string, any> | null, rest: D1Responder = () => undefined): D1Responder =>
  (call) => {
    if (/FROM "session" s JOIN "User" u/.test(call.sql) || /FROM "User" WHERE mcp_token = \?/.test(call.sql)) {
      return user
    }
    return rest(call)
  }

/** Request headers for a browser session / an MCP-token client. */
export const SESSION_COOKIE = { cookie: 'session_token=test-session-token' }
export const MCP_HEADER = { 'x-mcp-token': 'test-mcp-token' }
