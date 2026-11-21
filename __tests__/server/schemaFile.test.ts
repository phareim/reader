/** @jest-environment node */
/**
 * database/d1-schema.sql is what a fresh install runs; it must carry every
 * column the migrations add. Checked by column name against the ALTER TABLE
 * ADD COLUMN statements in database/migrations/.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const root = join(__dirname, '../../database')
const schema = readFileSync(join(root, 'd1-schema.sql'), 'utf8')

function tableBody(table: string): string {
  const m = schema.match(new RegExp(`CREATE TABLE IF NOT EXISTS "${table}" \\(([\\s\\S]*?)\\n\\);`))
  if (!m) throw new Error(`no CREATE TABLE "${table}" in d1-schema.sql`)
  return m[1]
}

const added = readdirSync(join(root, 'migrations'))
  .filter((f) => f.endsWith('.sql'))
  .flatMap((f) => [...readFileSync(join(root, 'migrations', f), 'utf8')
    .matchAll(/ALTER TABLE "?(\w+)"? ADD COLUMN (\w+)/gi)]
    .map((m) => ({ file: f, table: m[1], column: m[2] })))

describe('d1-schema.sql', () => {
  it('finds the migrations’ added columns to check', () => {
    expect(added.some((a) => a.table === 'Highlight' && a.column === 'taste_item_id')).toBe(true)
  })

  it.each(added.map((a) => [`${a.table}.${a.column} (${a.file})`, a]))('has %s', (_label, a: any) => {
    expect(tableBody(a.table)).toMatch(new RegExp(`^\\s*${a.column}\\s`, 'm'))
  })
})
