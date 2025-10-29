export const useClaude = () => {
  const sendMessage = async (prompt: string, system?: string) => {
    try {
      const data = await $fetch('/api/claude', {
        method: 'POST',
        body: {
          prompt,
          system
        }
      })

      return data
    } catch (error) {
      console.error('Error calling Claude API:', error)
      throw error
    }
  }

  const summarizeText = async (text: string) => {
    const system = 'You are a helpful assistant that creates concise summaries. Keep summaries brief but informative.'
    const prompt = `Please summarize the following text:\n\n${text}`

    return sendMessage(prompt, system)
  }

  const generateTitle = async (content: string) => {
    const system = 'You are a helpful assistant that generates short, catchy titles. Respond with only the title, no additional text.'
    const prompt = `Generate a title for the following content:\n\n${content}`

    return sendMessage(prompt, system)
  }

  const askQuestion = async (question: string, context?: string) => {
    const system = 'You are a helpful assistant integrated into The Librarian RSS application. Answer questions clearly and concisely.'
    const prompt = context
      ? `Context: ${context}\n\nQuestion: ${question}`
      : question

    return sendMessage(prompt, system)
  }

  return {
    sendMessage,
    summarizeText,
    generateTitle,
    askQuestion
  }
}