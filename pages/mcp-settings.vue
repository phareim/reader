<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-dark-bg dark:to-zinc-900 p-4">
    <div class="max-w-4xl mx-auto py-8">
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
          <div v-if="generatedToken" class="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg mb-6">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">Token Generated Successfully!</p>
            <div class="bg-white dark:bg-zinc-800 p-3 rounded font-mono text-xs break-all text-gray-900 dark:text-gray-100">
              {{ generatedToken }}
            </div>
            <p class="text-xs text-blue-600 dark:text-blue-400 mt-2">
              This token will only be shown once. Use one of the setup methods below.
            </p>
          </div>

          <!-- Setup Method Tabs -->
          <div class="mb-6">
            <div class="flex gap-2 border-b border-gray-200 dark:border-zinc-700">
              <button
                @click="setupMethod = 'automatic'"
                :class="[
                  'px-4 py-2 font-medium text-sm transition-colors',
                  setupMethod === 'automatic'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                ]"
              >
                Automatic Setup
              </button>
              <button
                @click="setupMethod = 'manual'"
                :class="[
                  'px-4 py-2 font-medium text-sm transition-colors',
                  setupMethod === 'manual'
                    ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
                ]"
              >
                Manual Setup
              </button>
            </div>
          </div>

          <!-- Automatic Setup -->
          <div v-if="setupMethod === 'automatic'" class="space-y-6">
            <!-- Method 1: One-liner command -->
            <div class="p-6 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
              <div class="flex items-start gap-3 mb-4">
                <span class="text-2xl">⚡</span>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Recommended: One-Line Setup</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Run this command in your terminal to set up everything automatically:
                  </p>
                </div>
              </div>

              <div class="bg-gray-900 dark:bg-black p-4 rounded-lg font-mono text-sm text-green-400 overflow-x-auto relative">
                <code>{{ oneLineCommand }}</code>
                <button
                  @click="copyToClipboard(oneLineCommand)"
                  class="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded transition-colors"
                  title="Copy to clipboard"
                >
                  📋
                </button>
              </div>

              <div class="mt-3 text-xs text-gray-600 dark:text-gray-400 space-y-1">
                <p><strong>What this does:</strong></p>
                <ul class="list-disc list-inside ml-2">
                  <li>Downloads and runs the setup script</li>
                  <li>Configures Claude Desktop automatically</li>
                  <li>No manual file editing required</li>
                </ul>
              </div>
            </div>

            <!-- Method 2: Download script -->
            <div class="p-6 bg-gray-50 dark:bg-zinc-800 rounded-lg">
              <div class="flex items-start gap-3 mb-4">
                <span class="text-2xl">📥</span>
                <div>
                  <h3 class="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">Download Setup Script</h3>
                  <p class="text-sm text-gray-600 dark:text-gray-400">
                    Download the script and run it manually:
                  </p>
                </div>
              </div>

              <div class="flex gap-3">
                <a
                  :href="`${config?.appUrl}/api/setup-mcp`"
                  download="setup-mcp.sh"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                  <span>⬇️</span>
                  Download setup-mcp.sh
                </a>
              </div>

              <div class="mt-4 bg-gray-100 dark:bg-zinc-900 p-3 rounded font-mono text-xs">
                <div class="text-gray-600 dark:text-gray-400 mb-1"># After downloading:</div>
                <div class="text-gray-900 dark:text-gray-100">chmod +x setup-mcp.sh</div>
                <div class="text-gray-900 dark:text-gray-100">./setup-mcp.sh --token {{ generatedToken || 'YOUR_TOKEN' }}</div>
              </div>
            </div>
          </div>

          <!-- Manual Setup -->
          <div v-if="setupMethod === 'manual'" class="space-y-6">
            <!-- System Info -->
            <div class="p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
              <h3 class="text-sm font-medium text-gray-900 dark:text-gray-100 mb-3">Detected System Information</h3>
              <div class="space-y-2 text-xs">
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">Repository Path:</span>
                  <code class="text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-zinc-700 px-2 py-1 rounded">{{ config?.repoPath }}</code>
                </div>
                <div class="flex justify-between">
                  <span class="text-gray-600 dark:text-gray-400">API URL:</span>
                  <code class="text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-zinc-700 px-2 py-1 rounded">{{ config?.appUrl }}</code>
                </div>
                <div class="flex justify-between items-start">
                  <span class="text-gray-600 dark:text-gray-400">Claude Config:</span>
                  <code class="text-gray-900 dark:text-gray-100 bg-gray-200 dark:bg-zinc-700 px-2 py-1 rounded text-right max-w-md break-all">{{ config?.claudeConfigPath }}</code>
                </div>
              </div>
            </div>

            <!-- Step 1: Download or Copy Config -->
            <div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">1. Get Configuration</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Download the pre-configured file or copy the JSON below:
              </p>

              <div class="flex gap-3 mb-4">
                <button
                  @click="downloadConfigFile"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                  <span>⬇️</span>
                  Download Config File
                </button>
                <button
                  @click="copyToClipboard(configJson)"
                  class="inline-flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 dark:bg-zinc-600 dark:hover:bg-zinc-500 text-white font-medium rounded-lg transition-colors"
                >
                  <span>📋</span>
                  Copy JSON
                </button>
              </div>

              <div class="bg-gray-50 dark:bg-zinc-800 p-4 rounded font-mono text-xs text-gray-900 dark:text-gray-100 overflow-x-auto max-h-96 overflow-y-auto">
                <pre>{{ configJson }}</pre>
              </div>
            </div>

            <!-- Step 2: Install Config -->
            <div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">2. Install Configuration</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Place the configuration file at:
              </p>
              <div class="bg-gray-50 dark:bg-zinc-800 p-3 rounded font-mono text-sm text-gray-900 dark:text-gray-100 mb-3">
                {{ config?.claudeConfigPath }}
              </div>
              <p class="text-xs text-gray-500 dark:text-gray-400">
                If the file already exists, merge the <code class="bg-gray-200 dark:bg-zinc-700 px-1 rounded">mcpServers</code> section with your existing configuration.
              </p>
            </div>

            <!-- Step 3: Restart -->
            <div>
              <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">3. Restart Claude Desktop</h3>
              <p class="text-sm text-gray-600 dark:text-gray-400">
                Completely quit and restart Claude Desktop for the changes to take effect.
              </p>
            </div>
          </div>

          <!-- Connection Test -->
          <div class="mt-8 p-6 bg-gray-50 dark:bg-zinc-800 rounded-lg">
            <h3 class="text-lg font-medium text-gray-900 dark:text-gray-100 mb-3">Test Your Connection</h3>
            <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">
              After setting up Claude Desktop, you can test the connection here:
            </p>

            <button
              @click="testConnection"
              :disabled="testingConnection"
              class="px-4 py-2 bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ testingConnection ? 'Testing...' : 'Test MCP Connection' }}
            </button>

            <!-- Test Result -->
            <div v-if="connectionTestResult" class="mt-4 p-4 rounded-lg" :class="[
              connectionTestResult.success
                ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
            ]">
              <p class="text-sm font-medium" :class="[
                connectionTestResult.success
                  ? 'text-green-800 dark:text-green-300'
                  : 'text-red-800 dark:text-red-300'
              ]">
                {{ connectionTestResult.success ? '✓' : '✗' }} {{ connectionTestResult.message }}
              </p>
              <p v-if="connectionTestResult.success" class="text-xs mt-1" :class="[
                connectionTestResult.success
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              ]">
                Connected as: {{ connectionTestResult.user?.email }}
              </p>
            </div>
          </div>

          <!-- Available Tools -->
          <div class="mt-6 p-4 bg-gray-50 dark:bg-zinc-800 rounded-lg">
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
  auth: true
})

const loading = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const generatedToken = ref<string | null>(null)
const config = ref<any>(null)
const setupMethod = ref<'automatic' | 'manual'>('automatic')
const testingConnection = ref(false)
const connectionTestResult = ref<any>(null)

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
    successMessage.value = 'Token revoked successfully'
    await loadConfig()
  } catch (err: any) {
    error.value = 'Failed to revoke token. Please try again.'
    console.error(err)
  } finally {
    loading.value = false
  }
}

const oneLineCommand = computed(() => {
  const token = generatedToken.value || 'YOUR_TOKEN_HERE'
  const appUrl = config.value?.appUrl || 'https://reader.phareim.no'
  return `curl -s ${appUrl}/api/install-mcp | bash -s -- --token ${token}`
})

const configJson = computed(() => {
  const repoPath = config.value?.repoPath || '/path/to/reader'
  const token = generatedToken.value || '[Your token will appear here after generation]'
  const appUrl = config.value?.appUrl || 'https://reader.phareim.no'

  return JSON.stringify({
    mcpServers: {
      'the-librarian': {
        command: 'node',
        args: [
          `${repoPath}/node_modules/.bin/tsx`,
          `${repoPath}/mcp-server/index.ts`
        ],
        env: {
          READER_API_URL: appUrl,
          MCP_TOKEN: token
        }
      }
    }
  }, null, 2)
})

const downloadConfigFile = () => {
  const blob = new Blob([configJson.value], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'claude_desktop_config.json'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  successMessage.value = 'Config file downloaded!'
  setTimeout(() => {
    successMessage.value = null
  }, 2000)
}

const testConnection = async () => {
  testingConnection.value = true
  connectionTestResult.value = null

  try {
    const result = await $fetch('/api/mcp/test')
    connectionTestResult.value = result
  } catch (err: any) {
    connectionTestResult.value = {
      success: false,
      message: 'Failed to connect to MCP server'
    }
  } finally {
    testingConnection.value = false
  }
}

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
