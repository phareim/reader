import type { FeedRig } from './types'

/**
 * Pluralistic (pluralistic.net).
 *
 * Each daily post carries the same long tail — appearances, book plugs,
 * colophon, subscription instructions, ISSN — behind the stable anchor
 * `<a name="upcoming">`, plus a leading HTML-comment metadata block and a
 * "Today's links" table of contents that mostly points at the removed
 * sections. Trim to the day's actual content: the essay, the "Hey look at
 * this" linkdump, and the "Object permanence" retrospective.
 *
 * entry only — the feed is full-text, so the fetch path never fires.
 */

/** Trim a Pluralistic post body to the day's content. Pure; exported for tests. */
export const trimPluralisticBody = (content: string): string => {
  let out = content

  // Leading HTML-comment metadata block (Tags/Summary/URL/Title/…).
  out = out.replace(/^\s*<!--[\s\S]*?-->\s*/, '')

  // "Today's links" ToC — the sections it points at are right below or removed.
  out = out.replace(/<h1[^>]*class="toch1"[^>]*>[\s\S]*?<\/h1>\s*<ul[^>]*class="toc"[^>]*>[\s\S]*?<\/ul>/i, '')

  // Everything from the "Upcoming appearances" anchor on is the recurring
  // boilerplate tail (appearances, books, colophon, ISSN).
  const tail = out.search(/(?:<hr\s*\/?>\s*)?<a name="upcoming">/i)
  if (tail !== -1) out = out.slice(0, tail)

  return out.trim()
}

export const pluralisticRig: FeedRig = {
  id: 'pluralistic',
  hosts: ['pluralistic.net'],

  entry(item) {
    const content = item.content || ''
    if (!content) return item
    const trimmed = trimPluralisticBody(content)
    return trimmed && trimmed !== content ? { ...item, content: trimmed } : item
  }
}
