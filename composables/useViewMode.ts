export type ViewMode = 'deck' | 'grid'

const STORAGE_KEY = 'reader:viewMode'

/**
 * The deck ↔ grid preference for the reading entrance. One global choice
 * covering every deck context (/, /[tag], /feed/[id], /found), persisted in
 * localStorage. SSR always sees 'deck'; consumers render mode-dependent UI
 * inside <ClientOnly> so a stored 'grid' never causes a hydration mismatch.
 */
export const useViewMode = () => {
  const viewMode = useState<ViewMode>('viewMode', () => 'deck')
  const hydrated = useState<boolean>('viewModeHydrated', () => false)

  if (import.meta.client && !hydrated.value) {
    hydrated.value = true
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored === 'deck' || stored === 'grid') viewMode.value = stored
    } catch {
      // Private mode / storage disabled — keep the default.
    }
  }

  const setViewMode = (mode: ViewMode) => {
    viewMode.value = mode
    if (import.meta.client) {
      try {
        localStorage.setItem(STORAGE_KEY, mode)
      } catch {
        // Best-effort persistence only.
      }
    }
  }

  return { viewMode: readonly(viewMode), setViewMode }
}
