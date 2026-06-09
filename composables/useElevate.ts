export const useElevate = () => ({
  // Real implementation lands with the elevate API task.
  elevate: async (_articleId: number): Promise<{ ideaId: string; existing: boolean }> => {
    throw new Error('Elevate not wired yet')
  },
  unElevate: async (_articleId: number, _ideaId?: string, _existing?: boolean) => {},
})
