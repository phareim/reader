import { parseHTML } from 'linkedom/worker'

/**
 * Email-body cleanup for the reader@phareim.no ingest path
 * (docs/email-ingest.md, Phase 2). Newsletter mail arrives as nested
 * layout-table soup with a Gmail forward block on top, hidden preheader
 * divs, and a tracking pixel at the tail. Display-time DOMPurify strips
 * `style` attributes, so anything hidden by style would become *visible*
 * junk — this pass runs once at ingest so the stored body (and therefore
 * display, search, RSVP, and read-aloud) is clean prose-shaped HTML.
 *
 * Everything here fails soft: `cleanEmailHtml` returns the raw input
 * unchanged if parsing throws, mirroring the per-feed-rig convention.
 */

export interface CleanedEmail {
  html: string
  /** Original sender recovered from the forward block ("TLDR"), if found. */
  author: string | null
  /**
   * The newsletter's hidden preview text — the best available summary,
   * since it is literally what the sender wrote as the preview.
   */
  preheader: string | null
}

// Invisible padding characters newsletters stuff into preheaders.
const INVISIBLE_RE = /[​‌‍⁠﻿­]/g

// Attributes that survive; matches the display-time DOMPurify allowlist
// minus `class` (email classes are per-message gibberish).
const KEEP_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'srcset', 'sizes', 'loading',
  'controls', 'poster', 'playsinline', 'preload', 'muted', 'type'
])

const FORWARD_MARKER_RE = /^(?:-{2,}\s*forwarded message\s*-{2,}|begin forwarded message\b)/i
// Outlook-style header block: starts with From:, carries Subject: too.
const HEADER_BLOCK_RE = /^from:/i

const normalizeText = (s: string | null | undefined): string =>
  (s || '').replace(INVISIBLE_RE, '').replace(/\s+/g, ' ').trim()

function extractAuthor(block: Element): string | null {
  const sender = block.querySelector('.gmail_sendername')
  const fromName = sender?.textContent || normalizeText(block.textContent).match(/from:\s*([^<\n]+?)\s*(?:<|$)/i)?.[1]
  const cleaned = normalizeText(fromName).replace(/^["']+|["']+$/g, '')
  // A bare email address is not a display name worth storing.
  if (!cleaned || /^[^\s]+@[^\s]+$/.test(cleaned)) return null
  return cleaned.slice(0, 200)
}

/**
 * Find and remove the forwarded-mail header block (Gmail's `gmail_attr`
 * div, Apple Mail's "Begin forwarded message:", Outlook's From/Sent/To/
 * Subject block), returning the original sender's display name if the
 * block carries one.
 */
function stripForwardBlock(document: any): string | null {
  const all: Element[] = Array.from(document.querySelectorAll('div, p, blockquote, span'))
  const matches = all.filter((el) => {
    const text = normalizeText(el.textContent)
    if (FORWARD_MARKER_RE.test(text)) return true
    // Outlook-style: a short block that is just the header lines.
    return HEADER_BLOCK_RE.test(text) && /subject:/i.test(text) && text.length < 600
  })
  // Ancestors match through their descendants' text — keep only the
  // innermost blocks so we never remove the whole message.
  const innermost = matches.filter((el) => !matches.some((other) => other !== el && el.contains(other)))
  let author: string | null = null
  for (const block of innermost) {
    author = author || extractAuthor(block)
    block.remove()
  }
  return author
}

function isHidden(el: Element): boolean {
  if (el.hasAttribute('hidden')) return true
  const style = el.getAttribute('style') || ''
  return /display\s*:\s*none/i.test(style) || /max-height\s*:\s*0/i.test(style)
}

/** First hidden div with real text = the newsletter's preview line. */
function capturePreheader(document: any): string | null {
  for (const el of document.querySelectorAll('[style]')) {
    if (!isHidden(el)) continue
    const text = normalizeText(el.textContent)
    if (text.length >= 20) return text.slice(0, 280)
  }
  return null
}

function isTrackingPixel(img: Element): boolean {
  const dim = (name: string) => parseInt(img.getAttribute(name) || '', 10)
  const w = dim('width')
  const h = dim('height')
  if (!Number.isNaN(w) && w <= 2 && !Number.isNaN(h) && h <= 2) return true
  const style = img.getAttribute('style') || ''
  return /width\s*:\s*[012]px/i.test(style) && /height\s*:\s*[012]px/i.test(style)
}

const LAYOUT_ATTRS = ['width', 'align', 'cellpadding', 'cellspacing', 'bgcolor', 'background']

function isLayoutTable(table: Element): boolean {
  if ((table.getAttribute('role') || '').toLowerCase() === 'presentation') return true
  if (LAYOUT_ATTRS.some((a) => table.hasAttribute(a))) return true
  if (table.querySelector('table')) return true
  // Single-column tables carry no tabular data.
  return Array.from(table.querySelectorAll('tr')).every(
    (tr) => tr.querySelectorAll('td, th').length <= 1
  )
}

function unwrap(el: Element): void {
  el.replaceWith(...Array.from(el.childNodes))
}

/**
 * Flatten layout tables into block flow: cells become <div>s, the table
 * scaffolding unwraps. Data tables (rare in mail, but possible) survive.
 */
function flattenLayoutTables(document: any): void {
  // Reverse document order processes innermost tables first, so an outer
  // table's unwrap never orphans a pending inner one.
  const tables: Element[] = Array.from(document.querySelectorAll('table')).reverse() as Element[]
  for (const table of tables) {
    if (!isLayoutTable(table)) continue
    for (const cell of Array.from(table.querySelectorAll('td, th')) as Element[]) {
      const div = document.createElement('div')
      div.append(...Array.from(cell.childNodes))
      cell.replaceWith(div)
    }
    for (const tag of ['caption', 'tr', 'thead', 'tbody', 'tfoot']) {
      for (const el of Array.from(table.querySelectorAll(tag)) as Element[]) unwrap(el)
    }
    unwrap(table)
  }
}

function stripAttributes(document: any): void {
  for (const el of document.querySelectorAll('*')) {
    for (const name of Array.from(el.getAttributeNames?.() || []) as string[]) {
      if (!KEEP_ATTRS.has(name.toLowerCase())) el.removeAttribute(name)
    }
  }
}

/**
 * Nav chrome rows — short blocks that are nothing but links and separators
 * ("Sign Up | Advertise | View Online", "Twitter | Facebook | Website").
 * Requiring ≥2 links keeps standalone referral/CTA links alive.
 */
function removeNavRows(document: any): void {
  for (const el of Array.from(document.querySelectorAll('div, p')) as Element[]) {
    if (!el.isConnected) continue
    const text = normalizeText(el.textContent)
    if (!text || text.length > 120) continue
    const links = el.querySelectorAll('a')
    if (links.length < 2) continue
    let residue = text
    for (const a of links) residue = residue.replace(normalizeText(a.textContent), '')
    if (!residue.replace(/[|•·—–\-\/\s]+/g, '')) el.remove()
  }
}

const MEDIA_SELECTOR = 'img, video'

function sweepEmptyBlocks(document: any): void {
  // Iterate to a fixed point: removing an empty leaf can empty its parent.
  for (let pass = 0; pass < 10; pass++) {
    let removed = 0
    for (const el of Array.from(
      document.querySelectorAll('div, p, span, strong, em, ul, ol, li, blockquote, h1, h2, h3, h4, h5, h6')
    ) as Element[]) {
      if (el.querySelector(MEDIA_SELECTOR)) continue
      if (normalizeText(el.textContent)) continue
      el.remove()
      removed++
    }
    if (!removed) break
  }
}

/** Runs of 3+ <br> (whitespace between them ignored) collapse to 2. */
function collapseBrRuns(document: any): void {
  for (const br of Array.from(document.querySelectorAll('br')) as Element[]) {
    if (!br.isConnected) continue
    let run: Element[] = []
    let node = br.nextSibling
    while (node) {
      const next: any = node.nextSibling
      if (node.nodeType === 3 && !normalizeText(node.textContent)) {
        node = next
        continue
      }
      if ((node as any).tagName === 'BR') {
        run.push(node as Element)
        node = next
        continue
      }
      break
    }
    for (const extra of run.slice(1)) extra.remove()
  }
}

/** Drop <br>s and blank text before the first real content, descending. */
function trimLeadingBreaks(root: Element): void {
  let el: Element | null = root
  while (el) {
    while (el.firstChild) {
      const first: any = el.firstChild
      if (first.nodeType === 3 && !normalizeText(first.textContent)) first.remove()
      else if (first.tagName === 'BR') first.remove()
      else break
    }
    const first: any = el.firstChild
    el = first && first.nodeType === 1 ? first : null
  }
}

export function cleanEmailHtml(rawHtml: string): CleanedEmail {
  try {
    const { document } = parseHTML(`<html><body>${rawHtml}</body></html>`)
    const body = document.body

    for (const el of document.querySelectorAll('script, style, link, meta, head')) el.remove()

    const author = stripForwardBlock(document)
    const preheader = capturePreheader(document)

    for (const el of Array.from(document.querySelectorAll('[style], [hidden]')) as Element[]) {
      if (isHidden(el)) el.remove()
    }
    for (const img of Array.from(document.querySelectorAll('img')) as Element[]) {
      if (isTrackingPixel(img)) img.remove()
    }

    flattenLayoutTables(document)
    stripAttributes(document)

    // Attribute-less inline wrappers carry nothing once styles are gone.
    for (const tag of ['font', 'center', 'span', 'u']) {
      for (const el of Array.from(document.querySelectorAll(tag)) as Element[]) {
        if ((el.getAttributeNames?.() || []).length === 0) unwrap(el)
      }
    }

    removeNavRows(document)
    sweepEmptyBlocks(document)
    collapseBrRuns(document)
    trimLeadingBreaks(body)

    const html = body.innerHTML.replace(INVISIBLE_RE, '').trim()
    // A clean that ate everything is a failed clean.
    if (!normalizeText(html) && !/<img|<video/i.test(html)) {
      return { html: rawHtml, author, preheader }
    }
    return { html, author, preheader }
  } catch {
    return { html: rawHtml, author: null, preheader: null }
  }
}

/**
 * Plain-text sibling of stripForwardBlock: shed the leading
 * "---------- Forwarded message ---------" + header lines from the text
 * part before it becomes a summary or a paragraphized body.
 */
export function stripTextForwardHeader(text: string): string {
  return text.replace(
    /^\s*(?:-{2,}\s*forwarded message\s*-{2,}|begin forwarded message:?)\s*\n(?:[a-z-]+:[^\n]*\n)+\s*/i,
    ''
  )
}
