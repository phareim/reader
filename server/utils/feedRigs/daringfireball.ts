import type { FeedRig } from './types'

/**
 * Daring Fireball (daringfireball.net).
 *
 * A link-blog: the entry URL points at the *linked* page, and Gruber's
 * commentary is the feed body. The commentary is short, so it trips the
 * reader's thin-body gate — and the full-text fetch then scrapes the
 * external page and overwrites the commentary with it. The feed body IS
 * the article; never fetch.
 */
export const daringFireballRig: FeedRig = {
  id: 'daringfireball',
  hosts: ['daringfireball.net'],

  entry(item) {
    return { ...item, fullTextComplete: true }
  }
}
