const STORAGE_KEY = 'reader:textSize'

/** Percent scale applied to the root font-size — everything is rem-sized, so this scales the whole UI. */
export const TEXT_SIZE = { MIN: 80, MAX: 130, STEP: 10, DEFAULT: 100 } as const

const clamp = (pct: number) => Math.min(TEXT_SIZE.MAX, Math.max(TEXT_SIZE.MIN, pct))

const apply = (pct: number) => {
  document.documentElement.style.fontSize = pct === TEXT_SIZE.DEFAULT ? '' : `${pct}%`
}

/**
 * Global text-size preference, adjusted from the Sources header (A− / A+).
 * Persisted in localStorage; applied to <html> on hydration (the
 * text-size.client.ts plugin touches this composable on every page load).
 * SSR always sees 100%, so the % readout renders inside <ClientOnly>.
 */
export const useTextSize = () => {
  const textSize = useState<number>('textSize', () => TEXT_SIZE.DEFAULT)
  const hydrated = useState<boolean>('textSizeHydrated', () => false)

  if (import.meta.client && !hydrated.value) {
    hydrated.value = true
    try {
      const stored = Number(localStorage.getItem(STORAGE_KEY))
      if (Number.isFinite(stored) && stored >= TEXT_SIZE.MIN && stored <= TEXT_SIZE.MAX) {
        textSize.value = stored
      }
    } catch {
      // Private mode / storage disabled — keep the default.
    }
    apply(textSize.value)
  }

  const setTextSize = (pct: number) => {
    textSize.value = clamp(pct)
    if (import.meta.client) {
      apply(textSize.value)
      try {
        localStorage.setItem(STORAGE_KEY, String(textSize.value))
      } catch {
        // Best-effort persistence only.
      }
    }
  }

  const increase = () => setTextSize(textSize.value + TEXT_SIZE.STEP)
  const decrease = () => setTextSize(textSize.value - TEXT_SIZE.STEP)

  return { textSize: readonly(textSize), increase, decrease }
}
