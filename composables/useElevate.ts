export const useElevate = () => {
  const elevate = async (articleId: number): Promise<{ ideaId: string; existing: boolean }> => {
    const res = await $fetch<{ ideaId: string; existing: boolean }>(
      `/api/articles/${articleId}/elevate`,
      { method: 'POST' },
    )
    return res
  }

  const unElevate = async (articleId: number, ideaId?: string, existing?: boolean) => {
    // Query params, not a body: Nitro's cloudflare-module entry drops DELETE
    // request bodies (it only buffers post/put/patch), which crashes the
    // Worker when the route tries to read one.
    await $fetch(`/api/articles/${articleId}/elevate`, {
      method: 'DELETE',
      query: { ideaId, existing },
    })
  }

  return { elevate, unElevate }
}
