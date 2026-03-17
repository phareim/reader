type SummaryArticle = {
  title: string
  url: string
  content?: string | null
  summary?: string | null
  feedTitle?: string
}

export const buildFlowingSummaryPrompt = (articles: SummaryArticle[]): { system: string; user: string } => {
  const wordLimit = Math.min(articles.length * 100, 2000)

  const system = `You are an expert summarizer. Write a single flowing summary of the provided articles. Rules:
- Write cohesive, flowing prose — NO bullet points, NO headings, NO numbered lists.
- For each article you mention, include an inline markdown link at the START of the first sentence about it, like: [Article Title](url) discusses...
- Cover the most important and interesting points across all articles.
- Use natural transitions between topics.
- Keep the tone informative and readable.
- Target approximately ${wordLimit} words.
- Do NOT include a title or introduction like "Here is a summary" — just start with the content.`

  const articleTexts = articles.map((a, i) => {
    const content = a.content || a.summary || ''
    const trimmed = content.slice(0, 600)
    return `[${i + 1}] "${a.title}" (${a.feedTitle || 'Unknown source'})
URL: ${a.url}
Content: ${trimmed}${content.length > 600 ? '...' : ''}`
  }).join('\n\n')

  const user = `Summarize these ${articles.length} articles in flowing prose:\n\n${articleTexts}`

  return { system, user }
}
