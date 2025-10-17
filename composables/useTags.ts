/**
 * Composable for managing user tags
 */

export interface Tag {
  id: number
  name: string
  color?: string | null
  createdAt: string
  feedCount: number
  savedArticleCount: number
}

export const useTags = () => {
  const tags = useState<Tag[]>('tags', () => [])
  const loading = useState<boolean>('tagsLoading', () => false)
  const error = useState<string | null>('tagsError', () => null)

  // Fetch all tags for the current user
  const fetchTags = async () => {
    loading.value = true
    error.value = null

    try {
      const response = await $fetch<Tag[]>('/api/tags')
      tags.value = response
    } catch (err: any) {
      error.value = err.message || 'Failed to fetch tags'
      console.error('Error fetching tags:', err)
    } finally {
      loading.value = false
    }
  }

  // Create a new tag
  const createTag = async (name: string, color?: string) => {
    loading.value = true
    error.value = null

    try {
      const newTag = await $fetch<Tag>('/api/tags', {
        method: 'POST',
        body: { name, color }
      })

      // Add to local state
      tags.value.push(newTag)

      return newTag
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to create tag'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update a tag (rename or change color)
  const updateTag = async (tagId: number, updates: { name?: string; color?: string | null }) => {
    loading.value = true
    error.value = null

    try {
      const updatedTag = await $fetch<Tag>(`/api/tags/${tagId}`, {
        method: 'PATCH',
        body: updates
      })

      // Update local state
      const index = tags.value.findIndex(t => t.id === tagId)
      if (index !== -1) {
        tags.value[index] = updatedTag
      }

      return updatedTag
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to update tag'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Delete a tag
  const deleteTag = async (tagId: number) => {
    loading.value = true
    error.value = null

    try {
      await $fetch(`/api/tags/${tagId}`, {
        method: 'DELETE'
      })

      // Remove from local state
      tags.value = tags.value.filter(t => t.id !== tagId)
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to delete tag'
      throw err
    } finally {
      loading.value = false
    }
  }

  // Update tags for a feed
  const updateFeedTags = async (feedId: number, tagNames: string[]) => {
    try {
      const response = await $fetch<{ success: boolean; tags: string[] }>(`/api/feeds/${feedId}/tags`, {
        method: 'PATCH',
        body: { tags: tagNames }
      })

      // Refresh tags to update counts
      await fetchTags()

      return response.tags
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to update feed tags'
      throw err
    }
  }

  // Update tags for a saved article
  const updateSavedArticleTags = async (savedArticleId: number, tagNames: string[]) => {
    try {
      const response = await $fetch<{ success: boolean; tags: string[] }>(`/api/saved-articles/${savedArticleId}/tags`, {
        method: 'PATCH',
        body: { tags: tagNames }
      })

      // Refresh tags to update counts
      await fetchTags()

      return response.tags
    } catch (err: any) {
      error.value = err.data?.message || err.message || 'Failed to update saved article tags'
      throw err
    }
  }

  // Get or create tags by name (useful for tag input)
  const ensureTagsExist = async (tagNames: string[]) => {
    const existingTagNames = new Set(tags.value.map(t => t.name))
    const newTagNames = tagNames.filter(name => !existingTagNames.has(name))

    // Create any new tags
    for (const name of newTagNames) {
      try {
        await createTag(name)
      } catch (err) {
        // Tag might already exist if created by another request
        console.warn(`Failed to create tag "${name}":`, err)
      }
    }

    // Refresh to get updated list
    if (newTagNames.length > 0) {
      await fetchTags()
    }
  }

  // Computed property for tags with counts (for components)
  const allTagsWithCounts = computed(() => {
    return tags.value.map(tag => ({
      name: tag.name,
      feedCount: tag.feedCount,
      savedArticleCount: tag.savedArticleCount
    }))
  })

  return {
    tags: readonly(tags),
    allTagsWithCounts,
    loading: readonly(loading),
    error: readonly(error),
    fetchTags,
    createTag,
    updateTag,
    deleteTag,
    updateFeedTags,
    updateSavedArticleTags,
    ensureTagsExist
  }
}
