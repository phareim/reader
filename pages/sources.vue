<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-24">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Sources</MonoLabel>
      <MonoLabel>{{ feeds.length }} feeds</MonoLabel>
    </header>
    <HairlineRule class="mt-3 mb-5" />

    <!-- Add feed -->
    <form class="flex items-end gap-3" @submit.prevent="add">
      <div class="flex-1">
        <MonoLabel>Add a feed</MonoLabel>
        <input
          v-model="newUrl" type="url" placeholder="https://…"
          class="w-full border-0 border-b border-rule bg-transparent py-1.5 text-ink outline-none focus:border-accent"
        />
      </div>
      <ActionLabel accent :disabled="adding || !newUrl" @click="add">
        {{ adding ? 'Adding…' : 'Add' }}
      </ActionLabel>
    </form>

    <!-- Grouped feed list -->
    <section v-for="(group, tag) in feedsByTag" :key="tag" class="mt-8">
      <NuxtLink
        v-if="tag !== '__inbox__' && !RESERVED.has(String(tag))"
        :to="`/${encodeURIComponent(String(tag))}`"
        class="focus-visible:outline focus-visible:outline-1"
      ><MonoLabel dash>{{ tag }}</MonoLabel></NuxtLink>
      <MonoLabel v-else dash>{{ tag === '__inbox__' ? 'Inbox' : String(tag) }}</MonoLabel>
      <ul class="mt-1">
        <li v-for="feed in group" :key="feed.id" class="border-b border-rule py-3">
          <div class="flex items-baseline justify-between gap-3">
            <span class="min-w-0 truncate text-lg text-ink">{{ feed.title }}</span>
            <MonoLabel>{{ feed.unreadCount }}</MonoLabel>
          </div>
          <div class="mt-1.5 flex gap-4">
            <button class="src-action" @click="markRead(feed.id)">Mark read</button>
            <button class="src-action" @click="editTags(feed)">Tags</button>
            <button class="src-action hover:text-accent-ink" @click="confirmDelete(feed)">Delete</button>
          </div>
        </li>
      </ul>
    </section>

    <!-- Footer -->
    <HairlineRule class="mt-10" />
    <footer class="mt-4 flex flex-wrap items-center justify-between gap-3">
      <ActionLabel :disabled="syncing" @click="sync">{{ syncing ? 'Syncing…' : 'Sync all' }}</ActionLabel>
      <div class="flex items-center gap-4">
        <NuxtLink to="/mcp-settings"><MonoLabel>MCP</MonoLabel></NuxtLink>
        <template v-if="user">
          <MonoLabel>{{ user.email }}</MonoLabel>
          <button class="src-action" @click="signOutAction">Sign out</button>
        </template>
        <NuxtLink v-else to="/login"><MonoLabel accent>Sign in</MonoLabel></NuxtLink>
      </div>
    </footer>
  </main>
</template>

<script setup lang="ts">
import type { Feed } from '~/types'

const RESERVED = new Set(['shelf', 'sources', 'login', 'mcp-settings', 'article'])

const { feeds, feedsByTag, fetchFeeds, addFeed, deleteFeed, syncAll, updateFeedTags } = useFeeds()
const { markAllAsRead, fetchArticles } = useArticles()
const { user, signOut } = useAuth()
const { showSuccess, showError } = useToast()

const newUrl = ref('')
const adding = ref(false)
const syncing = ref(false)

onMounted(() => fetchFeeds())

async function add() {
  if (!newUrl.value || adding.value) return
  adding.value = true
  try {
    const res = await addFeed(newUrl.value)
    showSuccess(`Added — ${res.articlesAdded} articles`)
    newUrl.value = ''
  } catch (err: any) {
    showError(err.data?.message || 'Could not add that feed')
  } finally {
    adding.value = false
  }
}

async function markRead(feedId: number) {
  try {
    await markAllAsRead(feedId)
    await fetchFeeds()
    showSuccess('Marked read')
  } catch { showError('Failed to mark read') }
}

async function editTags(feed: Feed) {
  const input = window.prompt('Tags (comma-separated)', feed.tags.join(', '))
  if (input === null) return
  const tags = input.split(',').map((t) => t.trim()).filter(Boolean)
  try {
    await updateFeedTags(feed.id, tags)
    showSuccess('Tags updated')
  } catch { showError('Failed to update tags') }
}

async function confirmDelete(feed: Feed) {
  if (!window.confirm(`Delete "${feed.title}" and all its articles?`)) return
  try {
    await deleteFeed(feed.id)
    showSuccess('Feed deleted')
  } catch { showError('Failed to delete feed') }
}

async function sync() {
  syncing.value = true
  try {
    await syncAll()
    await fetchArticles()
    showSuccess('All feeds synced')
  } catch { showError('Sync failed') }
  finally { syncing.value = false }
}

async function signOutAction() {
  await signOut()
  navigateTo('/login')
}
</script>

<style scoped>
.src-action {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.src-action:hover { color: var(--text-strong); }
.src-action:focus-visible { outline: 1px solid var(--tufte-accent); }
</style>
