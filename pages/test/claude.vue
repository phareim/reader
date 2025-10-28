<template>
  <div class="min-h-screen bg-gray-50 dark:bg-dark-bg p-8">
    <div class="max-w-4xl mx-auto">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">
        Claude Integration Test
      </h1>

      <!-- Connection Status -->
      <div class="mb-6 p-4 rounded-lg" :class="getStatusClasses()">
        <h2 class="text-lg font-semibold mb-2" :class="getStatusTextClasses()">
          Status: {{ connectionStatus }}
        </h2>
        <p class="text-sm" :class="getStatusTextClasses()">
          {{ statusMessage }}
        </p>
      </div>

      <!-- Test Interface -->
      <div class="bg-white dark:bg-zinc-900 rounded-lg shadow-lg p-6 mb-6">
        <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Chat with Claude
        </h2>

        <!-- Input Area -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Your Message:
            </label>
            <textarea
              v-model="userInput"
              @keydown.enter.shift.prevent="sendMessage"
              placeholder="Type your message here... (Shift+Enter to send)"
              class="w-full px-4 py-3 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-zinc-800 dark:text-gray-100 resize-none"
              rows="4"
            ></textarea>
          </div>

          <!-- Quick Actions -->
          <div class="flex flex-wrap gap-2">
            <button
              @click="sendHelloWorld"
              :disabled="loading"
              class="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
            >
              Send "Hello World"
            </button>
            <button
              @click="askAboutReader"
              :disabled="loading"
              class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
            >
              Ask About RSS Reader
            </button>
            <button
              @click="testSummarize"
              :disabled="loading"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg transition-colors text-sm"
            >
              Test Summarization
            </button>
          </div>

          <!-- Send Button -->
          <button
            @click="sendMessage"
            :disabled="loading || !userInput.trim()"
            class="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg transition-colors font-medium"
          >
            {{ loading ? 'Sending...' : 'Send Message' }}
          </button>
        </div>

        <!-- Response Display -->
        <div v-if="response || error" class="mt-6 border-t border-gray-200 dark:border-zinc-700 pt-6">
          <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
            Claude's Response:
          </h3>

          <div v-if="error" class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p class="text-red-800 dark:text-red-300">
              <strong>Error:</strong> {{ error }}
            </p>
          </div>

          <div v-else-if="response" class="space-y-3">
            <div class="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
              <p class="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{{ response }}</p>
            </div>

            <!-- Token Usage -->
            <div v-if="tokenUsage" class="text-xs text-gray-500 dark:text-gray-400">
              <span class="font-medium">Tokens used:</span>
              Input: {{ tokenUsage.input_tokens }},
              Output: {{ tokenUsage.output_tokens }}
              <span v-if="model" class="ml-2">
                | Model: {{ model }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Configuration Info -->
      <div class="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
        <h3 class="text-sm font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
          Configuration
        </h3>
        <div class="text-sm text-yellow-800 dark:text-yellow-200 space-y-1">
          <p>
            <strong>API Key Status:</strong>
            <span v-if="apiKeyConfigured" class="text-green-700 dark:text-green-400 font-medium">
              Configured ✓
            </span>
            <span v-else class="text-red-700 dark:text-red-400 font-medium">
              Not configured - Add ANTHROPIC_API_KEY to .env file
            </span>
          </p>
          <p class="text-xs mt-2">
            Get your API key from:
            <a href="https://console.anthropic.com/account/keys" target="_blank"
               class="text-blue-600 dark:text-blue-400 underline">
              Anthropic Console
            </a>
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

// Require authentication for this page
definePageMeta({
  auth: true
})

const { sendMessage: sendToClaude, summarizeText } = useClaude()

const userInput = ref('')
const response = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const connectionStatus = ref('checking')
const statusMessage = ref('Checking Claude integration...')
const apiKeyConfigured = ref(false)
const tokenUsage = ref<any>(null)
const model = ref<string>('')

const getStatusClasses = () => {
  switch (connectionStatus.value) {
    case 'ready':
      return 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
    case 'error':
      return 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
    default:
      return 'bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800'
  }
}

const getStatusTextClasses = () => {
  switch (connectionStatus.value) {
    case 'ready':
      return 'text-green-900 dark:text-green-100'
    case 'error':
      return 'text-red-900 dark:text-red-100'
    default:
      return 'text-yellow-900 dark:text-yellow-100'
  }
}

const checkConfiguration = async () => {
  try {
    // Test with a simple hello message
    const result = await sendToClaude('Say "Hello, I am Claude!" in exactly those words.')

    if (result.success) {
      apiKeyConfigured.value = true
      connectionStatus.value = 'ready'
      statusMessage.value = 'Claude integration is working! You can send messages below.'
      response.value = result.response
      tokenUsage.value = result.usage
      model.value = result.model
    } else {
      apiKeyConfigured.value = false
      connectionStatus.value = 'error'
      statusMessage.value = result.error || 'Failed to connect to Claude'
      error.value = result.error
    }
  } catch (err: any) {
    console.error('Configuration check error:', err)
    connectionStatus.value = 'error'
    statusMessage.value = 'Failed to check Claude configuration'
    error.value = err.message
  }
}

const sendMessage = async () => {
  if (!userInput.value.trim()) return

  loading.value = true
  error.value = null
  response.value = ''

  try {
    const result = await sendToClaude(userInput.value)

    if (result.success) {
      response.value = result.response
      tokenUsage.value = result.usage
      model.value = result.model
      connectionStatus.value = 'ready'
      statusMessage.value = 'Message sent successfully!'
    } else {
      error.value = result.error || 'Failed to send message'
      connectionStatus.value = 'error'
      statusMessage.value = 'Error sending message'
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred'
    connectionStatus.value = 'error'
    statusMessage.value = 'Failed to communicate with Claude'
  } finally {
    loading.value = false
  }
}

const sendHelloWorld = async () => {
  userInput.value = 'Hello, Claude! Please introduce yourself and tell me what you can help with.'
  await sendMessage()
}

const askAboutReader = async () => {
  userInput.value = 'What are some interesting features you could add to an RSS reader application?'
  await sendMessage()
}

const testSummarize = async () => {
  loading.value = true
  error.value = null
  response.value = ''

  try {
    const sampleText = `
    RSS (Really Simple Syndication or Rich Site Summary) is a web feed format that allows users
    to access updates to websites in a standardized, computer-readable format. These feeds can,
    for example, allow a user to keep track of many different websites in a single news aggregator.
    The news aggregator automatically checks the RSS feed for new content, allowing the list to be
    automatically updated when new content is available. RSS feed data is presented to users using
    software called an RSS reader or feed reader, which can be web-based, desktop-based, or mobile-device-based.
    `

    const result = await summarizeText(sampleText)

    if (result.success) {
      response.value = 'Summary:\n\n' + result.response
      tokenUsage.value = result.usage
      model.value = result.model
      userInput.value = 'Test summarization feature with sample text about RSS feeds'
    } else {
      error.value = result.error || 'Failed to summarize text'
    }
  } catch (err: any) {
    error.value = err.message || 'An error occurred'
  } finally {
    loading.value = false
  }
}

// Check configuration on mount
onMounted(() => {
  checkConfiguration()
})
</script>