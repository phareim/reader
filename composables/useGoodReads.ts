export const useGoodReads = () => {
  const goodReadIds = useState<Set<number>>('goodReadIds', () => new Set())

  const isGoodRead = (articleId: number) => {
    return goodReadIds.value.has(articleId)
  }

  // Seed one id's state without a list fetch — the article page knows its own
  // isGoodRead from GET /api/articles/:id.
  const seedGoodRead = (articleId: number, marked: boolean) => {
    if (marked === goodReadIds.value.has(articleId)) return
    const updated = new Set(goodReadIds.value)
    if (marked) updated.add(articleId)
    else updated.delete(articleId)
    goodReadIds.value = updated
  }

  const fetchGoodReadIds = async () => {
    try {
      const response = await $fetch<{ articles: Array<{ id: number }> }>('/api/good-reads')
      goodReadIds.value = new Set(response.articles.map(a => a.id))
    } catch (err) {
      console.error('Error fetching good reads:', err)
    }
  }

  const markGoodRead = async (articleId: number) => {
    // Optimistic update — replace Set to trigger Vue reactivity
    goodReadIds.value = new Set([...goodReadIds.value, articleId])

    try {
      await $fetch(`/api/articles/${articleId}/good-read`, {
        method: 'POST'
      })
    } catch (err) {
      // Revert on error
      const reverted = new Set(goodReadIds.value)
      reverted.delete(articleId)
      goodReadIds.value = reverted
      throw err
    }
  }

  const unmarkGoodRead = async (articleId: number) => {
    // Optimistic update — replace Set to trigger Vue reactivity
    const updated = new Set(goodReadIds.value)
    updated.delete(articleId)
    goodReadIds.value = updated

    try {
      await $fetch(`/api/articles/${articleId}/good-read`, {
        method: 'DELETE'
      })
    } catch (err) {
      // Revert on error
      goodReadIds.value = new Set([...goodReadIds.value, articleId])
      throw err
    }
  }

  const toggleGoodRead = async (articleId: number) => {
    if (isGoodRead(articleId)) {
      await unmarkGoodRead(articleId)
    } else {
      await markGoodRead(articleId)
    }
  }

  return {
    goodReadIds: readonly(goodReadIds),
    isGoodRead,
    seedGoodRead,
    fetchGoodReadIds,
    markGoodRead,
    unmarkGoodRead,
    toggleGoodRead
  }
}
