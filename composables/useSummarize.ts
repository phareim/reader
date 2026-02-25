import type { SummarizeResponse } from '~/types'

export const useSummarize = () => {
  const modalOpen = useState<boolean>('summarizeModalOpen', () => false)
  const loading = useState<boolean>('summarizing', () => false)
  const newsletter = useState<string>('newsletter', () => '')
  const metadata = useState<any>('summarizeMetadata', () => null)
  const error = useState<string | null>('summarizeError', () => null)

  const summarize = async (params: {
    feedId?: number
    tag?: string
    limit?: number
    isRead?: boolean
  }) => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<SummarizeResponse>('/api/articles/summarize', {
        method: 'POST',
        body: params
      })

      if (response.success) {
        newsletter.value = response.summary
        metadata.value = response.metadata
        modalOpen.value = true
      } else {
        error.value = response.error || 'Failed to generate summary'
        console.error('Summarization failed:', response.error)
      }
    } catch (err: any) {
      console.error('Summarization error:', err)
      error.value = err.data?.error || err.message || 'Failed to generate summary'
    } finally {
      loading.value = false
    }
  }

  const closeModal = () => {
    modalOpen.value = false
  }

  const clearError = () => {
    error.value = null
  }

  return {
    modalOpen,
    loading,
    newsletter,
    metadata,
    error,
    summarize,
    closeModal,
    clearError
  }
}
