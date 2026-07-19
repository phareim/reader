/**
 * GitHub starred repos → Found-feed items. Stars are PUBLIC
 * (api.github.com/users/:user/starred), so linking is by username only —
 * no OAuth, exactly like Hacker News favorites. The sync requests
 * `Accept: application/vnd.github.star+json` so each entry carries
 * `starred_at` (cards then order by when you starred, not when the repo
 * was made). Pure rendering here — no h3/D1 imports; unit-tested in
 * __tests__/server/githubStars.test.ts.
 */

import type { FoundItem } from '~/server/utils/xRender'

/** GitHub requires a User-Agent on every API call. */
export const GITHUB_UA = 'reader-found-sync/1.0 (reader.phareim.no)'

const esc = (s: any) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const compact = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}k` : String(n)

/**
 * Render one starred entry into a Found item. Accepts the star+json shape
 * ({ starred_at, repo }) and tolerates a plain repo object (the shape the
 * API returns without the star Accept header).
 */
export function renderGithubStar(entry: any): FoundItem | null {
  const repo = entry?.repo ?? entry
  if (!repo?.id || !repo.full_name || !repo.html_url) return null

  const starredAt = typeof entry?.starred_at === 'string' ? entry.starred_at : null
  const meta = [
    repo.language ? esc(repo.language) : null,
    repo.stargazers_count != null ? `★ ${compact(repo.stargazers_count)}` : null,
  ].filter(Boolean).join(' · ')
  const homepage =
    repo.homepage && /^https?:\/\//.test(repo.homepage) && repo.homepage !== repo.html_url
      ? repo.homepage
      : null

  const html = [
    `<p><strong>${esc(repo.full_name)}</strong></p>`,
    repo.description ? `<p>${esc(repo.description)}</p>` : '',
    meta ? `<p>${meta}</p>` : '',
    homepage ? `<p><a href="${esc(homepage)}">${esc(homepage.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, ''))} →</a></p>` : '',
    `<p><a href="${esc(repo.html_url)}">View on GitHub →</a></p>`,
  ].filter(Boolean).join('\n')

  return {
    source: 'github-star',
    externalId: String(repo.id),
    url: repo.html_url,
    title: repo.full_name,
    author: repo.owner?.login || undefined,
    content: html,
    summary: repo.description ? String(repo.description).slice(0, 280) : undefined,
    imageUrl: repo.owner?.avatar_url || undefined,
    publishedAt: starredAt || undefined,
  }
}
