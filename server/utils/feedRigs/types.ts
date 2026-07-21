import type { ParsedArticle } from '~/server/utils/feedParser'

export interface RigExtraction {
  /** The finished article body (already-escaped HTML). */
  html: string
  /** Card image; when omitted the caller falls back to the page's lead image. */
  imageUrl?: string | null
}

export interface RigPageContext {
  /** The article URL the page was fetched from. */
  url: string
  /** The fetched page HTML. */
  html: string
  /**
   * Fetch a follow-up page (multi-page stories). Same-host only and
   * budget-capped by the caller; resolves null on any failure.
   */
  fetchPage: (url: string) => Promise<string | null>
}

/**
 * A per-feed rig: bespoke handling for a feed worth extra work.
 * Both hooks are optional and MUST fail soft — any throw or null return
 * falls back to the generic pipeline, so a rig bug can never break sync
 * or full-text fetching.
 */
export interface FeedRig {
  id: string
  /** Hosts this rig owns; matched with a leading `www.` stripped. */
  hosts: string[]
  /** Sync-time, pure (no fetch): clean/transform a parsed entry before storage. */
  entry?: (item: ParsedArticle) => ParsedArticle
  /**
   * Full-text-time: build the body from the fetched page. Return null to
   * fall back to the generic Readability extraction.
   */
  extract?: (ctx: RigPageContext) => Promise<RigExtraction | null>
}
