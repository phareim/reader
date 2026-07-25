import type { Ref } from 'vue'
import { shouldRestorePosition, restoreScrollTop, progressWorthSaving } from '~/utils/readingPosition'

/**
 * Keeping your place in an article.
 *
 * The scroll position is saved server-side as a fraction of scrollable height
 * (`Article.read_progress`) — debounced 1.5s while scrolling, flushed on
 * unmount and on `visibilitychange` hidden, which is the last signal an iOS PWA
 * reliably gets. It is restored on re-entry once the body has settled.
 *
 * The decisions are pure and unit-tested in `utils/readingPosition.ts`: restore
 * only inside the 3%–95% band (a barely-started or finished article reopens at
 * the top), and skip writes under a 1% delta.
 *
 * The caller owns the listeners — wire `onScroll` to scroll, `updateProgress`
 * to resize, `onVisibilityChange` to visibilitychange, and call
 * `persistProgress()` on unmount.
 */
export function useReadingProgress(articleId: number, article: Ref<any>) {
  /** How far the page has scrolled, 0–100 — also drives the header rail. */
  const scrollPercent = ref(0)

  let lastSavedProgress = 0
  let progressSaveTimer: ReturnType<typeof setTimeout> | null = null

  function updateProgress() {
    // Read the scroll position defensively: normally the viewport scrolls
    // (window.scrollY), but a stray overflow on html/body can move the scroll
    // onto documentElement or body instead — so fall back across all three.
    const doc = document.documentElement
    const scrollTop = window.scrollY || doc.scrollTop || document.body.scrollTop || 0
    const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight)
    const max = scrollHeight - window.innerHeight
    scrollPercent.value = max > 0 ? Math.min(100, Math.max(0, (scrollTop / max) * 100)) : 0
  }

  function persistProgress() {
    if (progressSaveTimer) { clearTimeout(progressSaveTimer); progressSaveTimer = null }
    if (!article.value) return
    const p = Math.min(1, Math.max(0, scrollPercent.value / 100))
    if (!progressWorthSaving(p, lastSavedProgress)) return
    lastSavedProgress = p
    $fetch(`/api/articles/${articleId}/progress`, { method: 'PATCH', body: { progress: p } }).catch(() => {})
  }

  function scheduleProgressSave() {
    if (progressSaveTimer) clearTimeout(progressSaveTimer)
    progressSaveTimer = setTimeout(persistProgress, 1500)
  }

  async function restoreReadingPosition() {
    const stored = Number(article.value?.readProgress) || 0
    lastSavedProgress = stored
    if (!shouldRestorePosition(stored)) return
    await nextTick()
    const doc = document.documentElement
    const scrollHeight = Math.max(doc.scrollHeight, document.body.scrollHeight)
    window.scrollTo({ top: restoreScrollTop(stored, scrollHeight, window.innerHeight) })
  }

  // Backgrounding the (PWA) app may be the last signal we get — flush then.
  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') persistProgress()
  }

  return {
    scrollPercent,
    updateProgress,
    persistProgress,
    scheduleProgressSave,
    restoreReadingPosition,
    onVisibilityChange,
  }
}
