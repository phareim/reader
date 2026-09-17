/**
 * TypeSafe Jev interest score client.
 *
 * TypeSafe Jev (https://api.typesafe.ai) is a hosted decision model — POST a
 * `state` + `questions` shape, get back a 0..N score in ~0.5s, essentially
 * free. Evaluated 2026-09-17 on 400 of 480 labeled Reader articles: the
 * `interest` question below separated saved/good-read/highlighted articles
 * from untouched ones with AUC 0.80 overall, 0.70 within the same feed.
 * Combined with the feed half-life signal it improved deck ranking, so it is
 * wired in as a GENTLE boost (`server/api/articles/index.get.ts` DECAY_AGE)
 * — never a filter.
 *
 * Fails soft throughout: missing config, network error, timeout, a non-OK
 * response, or a malformed body all resolve to `null`, never throw. A
 * TypeSafe outage must not break the scoring job or the deck.
 */

import type { H3Event } from 'h3'
import { stripHtml } from '~/utils/cardData'

const TYPESAFE_URL = 'https://api.typesafe.ai/v1/systemone'
const REQUEST_TIMEOUT_MS = 15_000
const SUMMARY_MAX_CHARS = 600

// Fixed wording — this is what the 2026-09-17 eval scored. Edit only with a
// new eval to back it.
const READER_PROFILE =
  'Reader: Norwegian software developer and AI coach/organisational coach. ' +
  'Builds personal tools with AI agents (Claude Code, MCP), follows frontier ' +
  "AI labs, AI safety/ethics/policy, AI's impact on work, teams and " +
  'leadership, technical decision making, thoughtful long-form essays on ' +
  'technology, society and democracy. Not interested in gadget reviews, ' +
  'deals, sports, celebrity, or routine product/news briefs.'

export interface InterestArticleInput {
  feed: string
  title: string
  summary: string | null | undefined
}

/** Strip HTML and clamp to SUMMARY_MAX_CHARS — pure, unit-tested. */
export function cleanSummary(summary: string | null | undefined): string {
  const text = stripHtml(summary || '')
  return text.length > SUMMARY_MAX_CHARS ? text.slice(0, SUMMARY_MAX_CHARS) : text
}

/**
 * Build the exact TypeSafe Jev request body for one article. Pure — no
 * network — so it's directly unit-tested. Wording (state keys, the
 * `interest` question's instructions/criteria) is load-bearing: it is what
 * the eval above scored, and must stay verbatim.
 */
export function buildInterestRequest(article: InterestArticleInput) {
  return {
    model: 'jev-latest',
    state: {
      reader_profile: READER_PROFILE,
      article: {
        feed: article.feed,
        title: article.title,
        summary: cleanSummary(article.summary),
      },
    },
    questions: {
      interest: {
        type: 'score',
        instructions: 'How likely is this reader to save or deeply read this article?',
        criteria: [
          'Skip: off-topic, routine news, deals, gadgets',
          'Maybe: related topic but ordinary',
          "Save: substantive, thought-provoking piece squarely in the reader's interests",
        ],
      },
    },
  }
}

interface TypesafeConfig {
  key: string
}

export function getTypesafeConfig(event: H3Event): TypesafeConfig | null {
  // Event-scoped for the same reason as getSflConfig/getTasteConfig: on
  // Workers the env bindings only exist per-request.
  const config = useRuntimeConfig(event)
  if (!config.typesafeApiKey) return null
  return { key: config.typesafeApiKey }
}

/**
 * Score one article's interest (0..2), or `null` on any failure — unset
 * config, network error, timeout, non-OK response, or a missing/malformed
 * score. Never throws.
 */
export async function scoreInterest(
  event: H3Event,
  article: InterestArticleInput,
): Promise<number | null> {
  const cfg = getTypesafeConfig(event)
  if (!cfg) return null

  try {
    const res = await fetch(TYPESAFE_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${cfg.key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(buildInterestRequest(article)),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
    if (!res.ok) return null

    const body = await res.json() as {
      answers?: { interest?: { type?: string; score?: number } }
    }
    const score = body?.answers?.interest?.score
    return typeof score === 'number' && Number.isFinite(score) ? score : null
  } catch {
    return null
  }
}
