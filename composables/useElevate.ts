export const useElevate = () => {
  const elevate = async (articleId: number): Promise<{ ideaId: string; existing: boolean }> => {
    const res = await $fetch<{ ideaId: string; existing: boolean }>(
      `/api/articles/${articleId}/elevate`,
      { method: 'POST' },
    )
    return res
  }

  const unElevate = async (articleId: number, ideaId?: string, existing?: boolean) => {
    await $fetch(`/api/articles/${articleId}/elevate`, {
      method: 'DELETE',
      body: { ideaId, existing },
    })
  }

  return { elevate, unElevate }
}
