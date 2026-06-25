export interface Highlight {
  id: number
  sflIdeaId: string | null
  quote: string
  note: string | null
  startOffset: number
  endOffset: number
  createdAt?: string
}

export interface NewHighlight {
  quote: string
  note: string
  startOffset: number
  endOffset: number
}

/** Thin client for the highlight endpoints (mirrors useElevate). */
export const useHighlights = () => {
  const fetchHighlights = async (articleId: number): Promise<Highlight[]> => {
    const res = await $fetch<{ highlights: Highlight[] }>(
      `/api/articles/${articleId}/highlights`,
    )
    return res.highlights
  }

  const createHighlight = async (articleId: number, payload: NewHighlight): Promise<Highlight> => {
    const res = await $fetch<{ highlight: Highlight }>(
      `/api/articles/${articleId}/highlights`,
      { method: 'POST', body: payload },
    )
    return res.highlight
  }

  const deleteHighlight = async (id: number): Promise<void> => {
    // id in the path, no body: Nitro's cloudflare-module entry drops DELETE bodies.
    await $fetch(`/api/highlights/${id}`, { method: 'DELETE' })
  }

  return { fetchHighlights, createHighlight, deleteHighlight }
}
