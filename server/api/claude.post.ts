import Anthropic from '@anthropic-ai/sdk'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Get API key from environment variable
  const apiKey = process.env.ANTHROPIC_API_KEY

  if (!apiKey) {
    return {
      success: false,
      error: 'Claude API key is not configured. Please add ANTHROPIC_API_KEY to your .env file.'
    }
  }

  // Initialize Anthropic client
  const anthropic = new Anthropic({
    apiKey: apiKey,
  })

  try {
    // Make a request to Claude with the provided prompt
    const message = await anthropic.messages.create({
      model: "claude-haiku-4-5", // Using fast, cost-effective Haiku 4.5
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: body.prompt || "Hello, Claude"
        }
      ],
      system: body.system || undefined
    })

    console.log('Claude API Response:', message)

    return {
      success: true,
      response: message.content[0].type === 'text' ? message.content[0].text : '',
      usage: {
        input_tokens: message.usage?.input_tokens,
        output_tokens: message.usage?.output_tokens
      },
      model: message.model
    }
  } catch (error: any) {
    console.error('Claude API Error:', error)

    return {
      success: false,
      error: error.message || 'Failed to communicate with Claude',
      details: error.response?.data || error
    }
  }
})
