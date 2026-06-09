<template>
  <div class="min-h-screen bg-paper text-ink font-serif p-6">
    <div class="max-w-4xl mx-auto py-6">
      <!-- Header -->
      <div class="mb-6">
        <div class="flex items-start justify-between mb-4">
          <div>
            <MonoLabel>Integration</MonoLabel>
            <h1 class="text-3xl mt-1">Claude Desktop</h1>
          </div>
          <NuxtLink to="/" class="text-[13px] text-mute italic hover:text-accent-ink transition-colors whitespace-nowrap">
            ← Back to Reader
          </NuxtLink>
        </div>
        <p class="text-[14px] text-mute leading-[1.55]">
          Connect The Librarian to Claude Desktop using the Model Context Protocol (MCP).
        </p>
      </div>

      <HairlineRule />

      <!-- Token Status Section -->
      <section class="mt-6">
        <MonoLabel>Token Status</MonoLabel>

        <div v-if="config?.hasToken" class="mt-4 py-4 border-l-2 border-rule pl-4 flex items-start justify-between">
          <div>
            <p class="text-[14px] text-ink">Token active</p>
            <p class="text-[13px] text-mute italic mt-1">
              Created {{ formatDate(config.tokenCreatedAt) }}
            </p>
          </div>
          <button
            type="button"
            @click="revokeToken"
            :disabled="loading"
            class="text-[13px] text-mute italic hover:text-accent-ink transition-colors disabled:opacity-50"
          >
            Revoke
          </button>
        </div>

        <div v-else class="mt-4 py-4 border-l-2 border-rule pl-4">
          <p class="text-[14px] text-ink">No token generated</p>
          <p class="text-[13px] text-mute italic mt-1">
            Generate a token to connect Claude Desktop to your Reader account.
          </p>
        </div>

        <div class="mt-4">
          <ActionLabel
            accent
            :disabled="loading"
            @click="generateToken"
          >{{ config?.hasToken ? 'Regenerate Token' : 'Generate Token' }}</ActionLabel>
        </div>
      </section>

      <!-- Configuration Section -->
      <div v-if="generatedToken || config?.hasToken">
        <HairlineRule />

        <section>
          <MonoLabel>Setup Instructions</MonoLabel>

          <!-- Token reveal after generation -->
          <div v-if="generatedToken" class="mt-4">
            <p class="text-[13px] text-mute italic mb-2">
              This token is shown once. Use one of the setup methods below.
            </p>
            <div class="tufte-code break-all">{{ generatedToken }}</div>
          </div>

          <!-- Setup Method Tabs -->
          <div class="mt-6 flex gap-6 border-b border-rule">
            <button
              type="button"
              @click="setupMethod = 'automatic'"
              class="pb-2 -mb-px transition-colors"
              :class="setupMethod === 'automatic' ? 'border-b border-ink' : ''"
            >
              <MonoLabel
                :style="setupMethod === 'automatic' ? undefined : { color: 'var(--text-muted)', textShadow: 'none' }"
              >Automatic</MonoLabel>
            </button>
            <button
              type="button"
              @click="setupMethod = 'manual'"
              class="pb-2 -mb-px transition-colors"
              :class="setupMethod === 'manual' ? 'border-b border-ink' : ''"
            >
              <MonoLabel
                :style="setupMethod === 'manual' ? undefined : { color: 'var(--text-muted)', textShadow: 'none' }"
              >Manual</MonoLabel>
            </button>
          </div>

          <!-- Automatic Setup -->
          <div v-if="setupMethod === 'automatic'" class="mt-6 space-y-6">
            <div>
              <h3 class="text-xl">One-line setup</h3>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-4">
                Run this command in your terminal to set up everything automatically:
              </p>
              <div class="relative">
                <div class="tufte-code overflow-x-auto pr-12"><code>{{ oneLineCommand }}</code></div>
                <button
                  type="button"
                  @click="copyToClipboard(oneLineCommand)"
                  class="absolute top-2 right-2 text-mute hover:text-accent-ink transition-colors"
                  aria-label="Copy to clipboard"
                  title="Copy to clipboard"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </button>
              </div>
              <p class="text-[13px] text-mute italic mt-2">
                Downloads and runs the setup script, configures Claude Desktop automatically — no manual file editing.
              </p>
            </div>

            <div>
              <h3 class="text-xl">Download the script</h3>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-4">
                Download the script and run it manually:
              </p>
              <a
                :href="`${config?.appUrl}/api/setup-mcp`"
                download="setup-mcp.sh"
                class="inline-flex"
              >
                <span class="inline-flex items-baseline border border-rule px-3 py-2 hover:border-ink/40 transition-colors">
                  <MonoLabel :style="{ color: 'var(--text-muted)', textShadow: 'none' }">DOWNLOAD SETUP-MCP.SH</MonoLabel>
                </span>
              </a>
              <div class="tufte-code mt-4">
                <div class="text-mute"># After downloading:</div>
                <div>chmod +x setup-mcp.sh</div>
                <div>./setup-mcp.sh --token {{ generatedToken || 'YOUR_TOKEN' }}</div>
              </div>
            </div>
          </div>

          <!-- Manual Setup -->
          <div v-if="setupMethod === 'manual'" class="mt-6 space-y-6">
            <!-- System Info -->
            <div>
              <MonoLabel>Detected System Information</MonoLabel>
              <dl class="mt-2 space-y-2 text-[13px]">
                <div class="flex justify-between gap-4">
                  <dt class="text-mute italic">Repository path</dt>
                  <dd><code class="tufte-inline">{{ config?.repoPath }}</code></dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-mute italic">API URL</dt>
                  <dd><code class="tufte-inline">{{ config?.appUrl }}</code></dd>
                </div>
                <div class="flex justify-between gap-4 items-start">
                  <dt class="text-mute italic">Claude config</dt>
                  <dd class="text-right max-w-md break-all"><code class="tufte-inline">{{ config?.claudeConfigPath }}</code></dd>
                </div>
              </dl>
            </div>

            <!-- Step 1 -->
            <div>
              <h3 class="text-xl">1. Get configuration</h3>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-4">
                Download the pre-configured file or copy the JSON below:
              </p>
              <div class="flex items-center gap-4 mb-4">
                <ActionLabel @click="downloadConfigFile">Download Config</ActionLabel>
                <ActionLabel @click="copyToClipboard(configJson)">Copy JSON</ActionLabel>
              </div>
              <div class="tufte-code overflow-x-auto max-h-96 overflow-y-auto"><pre>{{ configJson }}</pre></div>
            </div>

            <!-- Step 2 -->
            <div>
              <h3 class="text-xl">2. Install configuration</h3>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-2">
                Place the configuration file at:
              </p>
              <div class="tufte-code">{{ config?.claudeConfigPath }}</div>
              <p class="text-[13px] text-mute italic mt-2">
                If the file already exists, merge the <code class="tufte-inline">mcpServers</code> section with your existing configuration.
              </p>
            </div>

            <!-- Step 3 -->
            <div>
              <h3 class="text-xl">3. Restart Claude Desktop</h3>
              <p class="text-[14px] text-mute leading-[1.55] mt-1">
                Completely quit and restart Claude Desktop for the changes to take effect.
              </p>
            </div>
          </div>

          <HairlineRule />

          <!-- Connection Test -->
          <div>
            <h3 class="text-xl">Test your connection</h3>
            <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-4">
              After setting up Claude Desktop, test the connection here:
            </p>
            <ActionLabel
              :disabled="testingConnection"
              @click="testConnection"
            >{{ testingConnection ? 'Testing' : 'Test Connection' }}</ActionLabel>

            <div v-if="connectionTestResult" class="mt-4 py-4 border-l-2 border-rule pl-4">
              <p class="text-[14px]" :class="connectionTestResult.success ? 'text-ink' : 'text-accent-ink'">
                {{ connectionTestResult.success ? '✓' : '✗' }} {{ connectionTestResult.message }}
              </p>
              <p v-if="connectionTestResult.success" class="text-[13px] text-mute italic mt-1">
                Connected as: {{ connectionTestResult.user?.email }}
              </p>
            </div>
          </div>

          <HairlineRule />

          <!-- Available Tools -->
          <div>
            <MonoLabel>Available MCP Tools</MonoLabel>
            <ul class="mt-2 text-[13px] text-mute space-y-1 leading-[1.55]">
              <li><span class="text-ink">list_feeds</span> — get all your RSS feeds</li>
              <li><span class="text-ink">get_recent_articles</span> — fetch recent articles</li>
              <li><span class="text-ink">get_saved_articles</span> — view saved articles</li>
              <li><span class="text-ink">save_article</span> — save articles for later</li>
              <li><span class="text-ink">add_article</span> — manually add articles</li>
              <li><span class="text-ink">tag_article</span> — organize with tags</li>
              <li class="italic">…and more</li>
            </ul>
          </div>
        </section>
      </div>

      <!-- Error / Success -->
      <div v-if="error" class="mt-6 border-l-2 border-rule pl-4">
        <p class="text-[13px] text-accent-ink italic">{{ error }}</p>
      </div>
      <div v-if="successMessage" class="mt-6 border-l-2 border-rule pl-4">
        <p class="text-[13px] text-mute italic">{{ successMessage }}</p>
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

<style scoped>
/* Hairline-framed code block — no rounded box, no shadow. */
.tufte-code {
  border: 1px solid var(--border-rule);
  padding: 12px;
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-strong);
  background: transparent;
}
.tufte-code pre {
  margin: 0;
  white-space: pre-wrap;
}
.tufte-inline {
  font-family: 'SF Mono', ui-monospace, monospace;
  font-size: 12px;
  color: var(--text-strong);
  border-bottom: 1px solid var(--border-rule);
  padding-bottom: 1px;
}
</style>
