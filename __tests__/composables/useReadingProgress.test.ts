/**
 * composables/useReadingProgress.ts against stand-ins for the Nuxt
 * auto-imports it uses (`ref`, `nextTick`, `$fetch`).
 */
import { ref, nextTick } from 'vue'

const $fetch = jest.fn()
Object.assign(globalThis, { ref, nextTick, $fetch })

import { useReadingProgress } from '~/composables/useReadingProgress'

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('useReadingProgress', () => {
  beforeEach(() => $fetch.mockReset())

  it('saves the position once and skips a second write at the same spot', async () => {
    $fetch.mockResolvedValue({ success: true })
    const progress = useReadingProgress(7, ref({ id: 7, readProgress: 0 }))

    progress.scrollPercent.value = 40
    progress.persistProgress()
    await settle()
    progress.persistProgress()

    expect($fetch).toHaveBeenCalledTimes(1)
    expect($fetch).toHaveBeenCalledWith('/api/articles/7/progress', { method: 'PATCH', body: { progress: 0.4 } })
  })

  it('tries again at the same spot after a failed write', async () => {
    $fetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ success: true })
    const progress = useReadingProgress(7, ref({ id: 7, readProgress: 0 }))

    progress.scrollPercent.value = 40
    progress.persistProgress() // the debounced save: fails
    await settle()
    progress.persistProgress() // the flush on leaving the article

    // A failed write must not count as saved, or the place is lost.
    expect($fetch).toHaveBeenCalledTimes(2)
  })

  it('writes nothing before the article has loaded', () => {
    const progress = useReadingProgress(7, ref(null))
    progress.scrollPercent.value = 40
    progress.persistProgress()
    expect($fetch).not.toHaveBeenCalled()
  })
})
