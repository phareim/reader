<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-dark-bg dark:to-zinc-900 p-4">
    <div class="max-w-3xl mx-auto py-8">
      <!-- Header -->
      <div class="mb-8">
        <div class="flex items-center justify-between mb-4">
          <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100">Claude Desktop Integration</h1>
          <NuxtLink
            to="/"
            class="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            ← Back to Reader
          </NuxtLink>
        </div>
        <p class="text-gray-600 dark:text-gray-400">
          Connect The Librarian to Claude Desktop using the Model Context Protocol (MCP)
        </p>
      </div>

      <!-- Main Card -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 mb-6">
        <!-- Token Status Section -->
        <div class="mb-8">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Token Status</h2>

          <div v-if="config?.hasToken" class="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg mb-4">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-sm font-medium text-green-800 dark:text-green-300">Token Active</p>
                <p class="text-xs text-green-600 dark:text-green-400 mt-1">
                  Created {{ formatDate(config.tokenCreatedAt) }}
                </p>
              </div>
              <button
                @click="revokeToken"
                :disabled="loading"
                class="px-3 py-1 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors disabled:opacity-50"
              >
                Revoke
              </button>
            </div>
          </div>

          <div v-else class="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg mb-4">
            <p class="text-sm font-medium text-yellow-800 dark:text-yellow-300">No Token Generated</p>
            <p class="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
              Generate a token to connect Claude Desktop to your Reader account
            </p>
          </div>

          <button
            @click="generateToken"
            :disabled="loading"
            class="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ config?.hasToken ? 'Regenerate Token' : 'Generate Token' }}
          </button>
        </div>

        <!-- Configuration Section -->
        <div v-if="generatedToken || config?.hasToken">
          <h2 class="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-4">Setup Instructions</h2>

          <!-- Success message after generation -->
          <div v-if="generatedToken" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-4">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Token Generated Successfully!</p>
            <div class="bg-white dark:bg-zinc-800 p-3 rounded font-mono text-xs break-all text-gray-900 dark:text-gray-100">
              {{ generatedToken }}
            </div>
            <p class="text-xs text-blue-600 dark:text-blue-400 mt-2">
              This token will only be shown once. Continue below to set up Claude Desktop.
            </p>
          </div>

          <!-- Step 1: Clone Repository -->
          <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">1. Clone the Repository</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Clone The Librarian repository to your local machine:
            </p>
            <div class="bg-gray-50 dark:bg-zinc-800 p-3 rounded font-mono text-sm text-gray-900 dark:text-gray-100 relative">
              <code>git clone https://github.com/your-username/reader.git</code>
              <button
                @click="copyToClipboard('git clone https://github.com/your-username/reader.git')"
                class="absolute top-2 right-2 p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Then run <code class="bg-gray-200 dark:bg-zinc-700 px-1 rounded">npm install</code> in the cloned directory
            </p>
          </div>

          <!-- Step 2: Repository Path Input -->
          <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">2. Enter Repository Path</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Enter the absolute path to your cloned repository:
            </p>
            <input
              v-model="repoPath"
              type="text"
              placeholder="/Users/username/path/to/reader"
              class="w-full px-4 py-2 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 dark:text-gray-100"
            />
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Tip: Run <code class="bg-gray-200 dark:bg-zinc-700 px-1 rounded">pwd</code> in the repository directory to get the path
            </p>
          </div>

          <!-- Step 3: Configuration -->
          <div v-if="repoPath" class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">3. Copy Configuration</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
              Add this to your Claude Desktop config file:
            </p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mb-2">
              <strong>macOS:</strong> <code class="bg-gray-200 dark:bg-zinc-700 px-1 rounded">~/Library/Application Support/Claude/claude_desktop_config.json</code><br>
              <strong>Windows:</strong> <code class="bg-gray-200 dark:bg-zinc-700 px-1 rounded">%APPDATA%\Claude\claude_desktop_config.json</code>
            </p>
            <div class="bg-gray-50 dark:bg-zinc-800 p-4 rounded font-mono text-xs text-gray-900 dark:text-gray-100 overflow-x-auto relative">
              <pre>{{ configJson }}</pre>
              <button
                @click="copyToClipboard(configJson)"
                class="absolute top-2 right-2 p-2 hover:bg-gray-200 dark:hover:bg-zinc-700 rounded transition-colors"
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
          </div>

          <!-- Step 4: Restart Claude -->
          <div class="mb-6">
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">4. Restart Claude Desktop</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400">
              Completely quit and restart Claude Desktop for the changes to take effect. The Librarian tools will then be available in Claude.
            </p>
          </div>

          <!-- Available Tools -->
          <div class="mt-8 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-2">Available MCP Tools</h3>
            <ul class="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• <strong>list_feeds</strong> - Get all your RSS feeds</li>
              <li>• <strong>get_recent_articles</strong> - Fetch recent articles</li>
              <li>• <strong>get_saved_articles</strong> - View saved articles</li>
              <li>• <strong>save_article</strong> - Save articles for later</li>
              <li>• <strong>add_article</strong> - Manually add articles</li>
              <li>• <strong>tag_article</strong> - Organize with tags</li>
              <li>• And more...</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Error Message -->
      <div v-if="error" class="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
      </div>

      <!-- Success Message -->
      <div v-if="successMessage" class="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
        <p class="text-sm text-green-600 dark:text-green-400">{{ successMessage }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  middleware: 'auth'
})

const loading = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const generatedToken = ref<string | null>(null)
const repoPath = ref('')
const config = ref<any>(null)

// Load config on mount
onMounted(async () => {
  await loadConfig()
})

const loadConfig = async () => {
  try {
    const response = await $fetch('/api/user/mcp-config')
    config.value = response
  } catch (err: any) {
    error.value = 'Failed to load configuration'
    console.error(err)
  }
}

const generateToken = async () => {
  loading.value = true
  error.value = null
  successMessage.value = null

  try {
    const response = await $fetch('/api/user/mcp-token', {
      method: 'POST'
    })

    generatedToken.value = response.token
    successMessage.value = 'Token generated successfully!'
    await loadConfig()

    // Clear success message after 5 seconds
    setTimeout(() => {
      successMessage.value = null
    }, 5000)
  } catch (err: any) {
    error.value = 'Failed to generate token. Please try again.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const revokeToken = async () => {
  if (!confirm('Are you sure you want to revoke your MCP token? Claude Desktop will no longer be able to access your Reader account.')) {
    return
  }

  loading.value = true
  error.value = null
  successMessage.value = null

  try {
    await $fetch('/api/user/mcp-token', {
      method: 'DELETE'
    })

    generatedToken.value = null
    repoPath.value = ''
    successMessage.value = 'Token revoked successfully'
    await loadConfig()
  } catch (err: any) {
    error.value = 'Failed to revoke token. Please try again.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const configJson = computed(() => {
  if (!repoPath.value) return ''

  const token = generatedToken.value || '[Your token will appear here after generation]'
  const appUrl = config.value?.appUrl || 'https://reader.phareim.no'

  return JSON.stringify({
    mcpServers: {
      'the-librarian': {
        command: 'node',
        args: [
          `${repoPath.value}/node_modules/.bin/tsx`,
          `${repoPath.value}/mcp-server/index.ts`
        ],
        env: {
          READER_API_URL: appUrl,
          MCP_TOKEN: token
        }
      }
    }
  }, null, 2)
})

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
    successMessage.value = 'Copied to clipboard!'
    setTimeout(() => {
      successMessage.value = null
    }, 2000)
  } catch (err) {
    error.value = 'Failed to copy to clipboard'
  }
}

const formatDate = (date: string | undefined) => {
  if (!date) return 'Unknown'
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}
</script>
