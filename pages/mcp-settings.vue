<template>
  <div class="min-h-screen bg-paper text-ink font-serif p-almanac-gutter">
    <div class="max-w-4xl mx-auto py-almanac-gutter">
      <!-- Header -->
      <div class="mb-almanac-gutter">
        <div class="flex items-start justify-between mb-almanac-section-gap">
          <div>
            <MonoLabel as="span">Integration</MonoLabel>
            <SerifHeadline level="h1" class="mt-1">Claude Desktop</SerifHeadline>
          </div>
          <NuxtLink to="/" class="text-[13px] text-mute italic hover:text-rust transition-colors whitespace-nowrap">
            ← Back to Reader
          </NuxtLink>
        </div>
        <p class="text-[14px] text-mute leading-[1.55]">
          Connect The Librarian to Claude Desktop using the Model Context Protocol (MCP).
        </p>
      </div>

      <HeaderDivider />

      <!-- Token Status Section -->
      <section class="mt-almanac-gutter">
        <MonoLabel as="h2">Token Status</MonoLabel>

        <div v-if="config?.hasToken" class="mt-almanac-section-gap py-almanac-section-gap border-l-2 border-rule pl-almanac-section-gap flex items-start justify-between">
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
            class="text-[13px] text-mute italic hover:text-rust transition-colors disabled:opacity-50"
          >
            Revoke
          </button>
        </div>

        <div v-else class="mt-almanac-section-gap py-almanac-section-gap border-l-2 border-rule pl-almanac-section-gap">
          <p class="text-[14px] text-ink">No token generated</p>
          <p class="text-[13px] text-mute italic mt-1">
            Generate a token to connect Claude Desktop to your Reader account.
          </p>
        </div>

        <div class="mt-almanac-section-gap">
          <ActionLabel
            :label="config?.hasToken ? 'REGENERATE TOKEN' : 'GENERATE TOKEN'"
            accent
            :disabled="loading"
            @click="generateToken"
          />
        </div>
      </section>

      <!-- Configuration Section -->
      <div v-if="generatedToken || config?.hasToken">
        <SectionDivider />

        <section>
          <MonoLabel as="h2">Setup Instructions</MonoLabel>

          <!-- Token reveal after generation -->
          <div v-if="generatedToken" class="mt-almanac-section-gap">
            <p class="text-[13px] text-mute italic mb-2">
              This token is shown once. Use one of the setup methods below.
            </p>
            <div class="almanac-code break-all">{{ generatedToken }}</div>
          </div>

          <!-- Setup Method Tabs -->
          <div class="mt-almanac-gutter flex gap-almanac-gutter border-b border-rule">
            <button
              type="button"
              @click="setupMethod = 'automatic'"
              class="pb-2 -mb-px transition-colors"
              :class="setupMethod === 'automatic' ? 'border-b border-ink' : ''"
            >
              <MonoLabel
                as="span"
                :style="setupMethod === 'automatic' ? undefined : { color: 'var(--almanac-fg-mute)', textShadow: 'none' }"
              >Automatic</MonoLabel>
            </button>
            <button
              type="button"
              @click="setupMethod = 'manual'"
              class="pb-2 -mb-px transition-colors"
              :class="setupMethod === 'manual' ? 'border-b border-ink' : ''"
            >
              <MonoLabel
                as="span"
                :style="setupMethod === 'manual' ? undefined : { color: 'var(--almanac-fg-mute)', textShadow: 'none' }"
              >Manual</MonoLabel>
            </button>
          </div>

          <!-- Automatic Setup -->
          <div v-if="setupMethod === 'automatic'" class="mt-almanac-gutter space-y-almanac-gutter">
            <div>
              <SerifHeadline level="h3">One-line setup</SerifHeadline>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-almanac-section-gap">
                Run this command in your terminal to set up everything automatically:
              </p>
              <div class="relative">
                <div class="almanac-code overflow-x-auto pr-12"><code>{{ oneLineCommand }}</code></div>
                <button
                  type="button"
                  @click="copyToClipboard(oneLineCommand)"
                  class="absolute top-2 right-2 text-mute hover:text-rust transition-colors"
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
              <SerifHeadline level="h3">Download the script</SerifHeadline>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-almanac-section-gap">
                Download the script and run it manually:
              </p>
              <a
                :href="`${config?.appUrl}/api/setup-mcp`"
                download="setup-mcp.sh"
                class="inline-flex"
              >
                <span class="inline-flex items-baseline border border-rule px-3 py-2 hover:border-ink/40 transition-colors">
                  <MonoLabel as="span" :style="{ color: 'var(--almanac-fg-mute)', textShadow: 'none' }">DOWNLOAD SETUP-MCP.SH</MonoLabel>
                </span>
              </a>
              <div class="almanac-code mt-almanac-section-gap">
                <div class="text-mute"># After downloading:</div>
                <div>chmod +x setup-mcp.sh</div>
                <div>./setup-mcp.sh --token {{ generatedToken || 'YOUR_TOKEN' }}</div>
              </div>
            </div>
          </div>

          <!-- Manual Setup -->
          <div v-if="setupMethod === 'manual'" class="mt-almanac-gutter space-y-almanac-gutter">
            <!-- System Info -->
            <div>
              <MonoLabel as="h3">Detected System Information</MonoLabel>
              <dl class="mt-2 space-y-2 text-[13px]">
                <div class="flex justify-between gap-4">
                  <dt class="text-mute italic">Repository path</dt>
                  <dd><code class="almanac-inline">{{ config?.repoPath }}</code></dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-mute italic">API URL</dt>
                  <dd><code class="almanac-inline">{{ config?.appUrl }}</code></dd>
                </div>
                <div class="flex justify-between gap-4 items-start">
                  <dt class="text-mute italic">Claude config</dt>
                  <dd class="text-right max-w-md break-all"><code class="almanac-inline">{{ config?.claudeConfigPath }}</code></dd>
                </div>
              </dl>
            </div>

            <!-- Step 1 -->
            <div>
              <SerifHeadline level="h3">1. Get configuration</SerifHeadline>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-almanac-section-gap">
                Download the pre-configured file or copy the JSON below:
              </p>
              <div class="flex items-center gap-almanac-section-gap mb-almanac-section-gap">
                <ActionLabel label="DOWNLOAD CONFIG" @click="downloadConfigFile" />
                <ActionLabel label="COPY JSON" @click="copyToClipboard(configJson)" />
              </div>
              <div class="almanac-code overflow-x-auto max-h-96 overflow-y-auto"><pre>{{ configJson }}</pre></div>
            </div>

            <!-- Step 2 -->
            <div>
              <SerifHeadline level="h3">2. Install configuration</SerifHeadline>
              <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-2">
                Place the configuration file at:
              </p>
              <div class="almanac-code">{{ config?.claudeConfigPath }}</div>
              <p class="text-[13px] text-mute italic mt-2">
                If the file already exists, merge the <code class="almanac-inline">mcpServers</code> section with your existing configuration.
              </p>
            </div>

            <!-- Step 3 -->
            <div>
              <SerifHeadline level="h3">3. Restart Claude Desktop</SerifHeadline>
              <p class="text-[14px] text-mute leading-[1.55] mt-1">
                Completely quit and restart Claude Desktop for the changes to take effect.
              </p>
            </div>
          </div>

          <SectionDivider />

          <!-- Connection Test -->
          <div>
            <SerifHeadline level="h3">Test your connection</SerifHeadline>
            <p class="text-[14px] text-mute leading-[1.55] mt-1 mb-almanac-section-gap">
              After setting up Claude Desktop, test the connection here:
            </p>
            <ActionLabel
              :label="testingConnection ? 'TESTING' : 'TEST CONNECTION'"
              :disabled="testingConnection"
              @click="testConnection"
            />

            <div v-if="connectionTestResult" class="mt-almanac-section-gap py-almanac-section-gap border-l-2 border-rule pl-almanac-section-gap">
              <p class="text-[14px]" :class="connectionTestResult.success ? 'text-ink' : 'text-rust'">
                {{ connectionTestResult.success ? '✓' : '✗' }} {{ connectionTestResult.message }}
              </p>
              <p v-if="connectionTestResult.success" class="text-[13px] text-mute italic mt-1">
                Connected as: {{ connectionTestResult.user?.email }}
              </p>
            </div>
          </div>

          <SectionDivider />

          <!-- Available Tools -->
          <div>
            <MonoLabel as="h3">Available MCP Tools</MonoLabel>
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
      <div v-if="error" class="mt-almanac-gutter border-l-2 border-rule pl-almanac-section-gap">
        <p class="text-[13px] text-rust italic">{{ error }}</p>
      </div>
      <div v-if="successMessage" class="mt-almanac-gutter border-l-2 border-rule pl-almanac-section-gap">
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
.almanac-code {
  border: 1px solid var(--almanac-rule-line);
  padding: 12px;
  font-family: var(--almanac-mono, "SF Mono", ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.6;
  color: var(--almanac-fg);
  background: transparent;
}
.almanac-code pre {
  margin: 0;
  white-space: pre-wrap;
}
.almanac-inline {
  font-family: var(--almanac-mono, "SF Mono", ui-monospace, monospace);
  font-size: 12px;
  color: var(--almanac-fg);
  border-bottom: 1px solid var(--almanac-rule-line);
  padding-bottom: 1px;
}
</style>
