/** @jest-environment node */
/**
 * scripts/sleeper-articles-sync.mjs refuses to start without ARTICLES_API_KEY:
 * every sleeper-articles route but /health takes the Bearer. Runs the script
 * with a throwaway HOME, so it never reads the real config or reaches a host.
 */
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const script = join(__dirname, '../../scripts/sleeper-articles-sync.mjs')

function runWith(articlesEnv: string) {
  const home = mkdtempSync(join(tmpdir(), 'reader-sa-'))
  try {
    mkdirSync(join(home, '.config', 'reader'), { recursive: true })
    mkdirSync(join(home, '.config', 'sleeper-articles'), { recursive: true })
    writeFileSync(join(home, '.config', 'reader', 'env'), 'READER_API_URL=http://127.0.0.1:9\nREADER_MCP_TOKEN=t\n')
    writeFileSync(join(home, '.config', 'sleeper-articles', 'env'), articlesEnv)
    return spawnSync(process.execPath, [script, '--dry-run'], {
      env: { PATH: process.env.PATH ?? '', HOME: home },
      encoding: 'utf8',
      timeout: 20_000,
    })
  } finally {
    rmSync(home, { recursive: true, force: true })
  }
}

describe('sleeper-articles-sync.mjs', () => {
  it('stops at start with one clear line when ARTICLES_API_KEY is empty', () => {
    for (const env of ['ARTICLES_API_URL=http://127.0.0.1:9\n', 'ARTICLES_API_KEY=\n']) {
      const run = runWith(env)
      expect(run.status).toBe(1)
      const lines = run.stderr.trim().split('\n')
      expect(lines).toHaveLength(1)
      expect(lines[0]).toContain('missing ARTICLES_API_KEY')
    }
  })
})
