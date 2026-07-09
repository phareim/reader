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
          v-model="newUrl" type="text" inputmode="url" autocapitalize="off" autocorrect="off" spellcheck="false"
          placeholder="vg.no or https://…/feed.xml"
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
      <TransitionGroup tag="ul" name="feed-row" class="mt-1">
        <li v-for="feed in group" :key="feed.id" class="feed-row border-b border-rule py-3">
          <div class="flex items-baseline justify-between gap-3">
            <NuxtLink
              :to="`/feed/${feed.id}`"
              class="min-w-0 truncate text-lg text-ink hover:text-accent-ink focus-visible:outline focus-visible:outline-1"
            >{{ feed.title }}</NuxtLink>
            <MonoLabel>{{ feed.unreadCount }}</MonoLabel>
          </div>
          <div class="mt-1.5 flex gap-4">
            <button class="src-action" @click="markRead(feed.id)">Mark read</button>
            <button class="src-action" @click="editTags(feed)">Tags</button>
            <button class="src-action hover:text-accent-ink" @click="confirmDelete(feed)">Delete</button>
          </div>
        </li>
      </TransitionGroup>
    </section>

    <!-- Linked accounts (X bookmarks → Found). Hidden for guests and while
         the OAuth client is unconfigured. -->
    <section v-if="xLink?.available" class="mt-10">
      <MonoLabel dash>X account</MonoLabel>
      <div class="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3">
        <template v-if="xLink.linked">
          <div class="min-w-0">
            <span class="text-lg text-ink">@{{ xLink.handle }}</span>
            <p class="mt-1 text-sm text-mute">
              <template v-if="xLink.lastError">Sync failing — try relinking.</template>
              <template v-else-if="xLink.lastSyncAt">Bookmarks synced {{ formatRelativeDate(xLink.lastSyncAt) }}.</template>
              <template v-else>Linked — bookmarks land in Found on the next sync.</template>
            </p>
          </div>
          <div class="flex items-center gap-4">
            <ActionLabel v-if="xLink.lastError" accent @click="linkX">Relink</ActionLabel>
            <button class="src-action" @click="unlinkX">Unlink</button>
          </div>
        </template>
        <template v-else>
          <p class="text-sm text-mute">Bring your X bookmarks into the Found feed.</p>
          <ActionLabel @click="linkX">Link X account</ActionLabel>
        </template>
      </div>
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

    <TagEditorOverlay
      v-if="tagEditorFeed"
      :feed="tagEditorFeed"
      :all-tags="allTags"
      @close="tagEditorFeed = null"
      @save="saveTags"
    />

    <FeedPickerOverlay
      v-if="discovered"
      :feeds="discovered"
      :added-urls="addedUrls"
      :busy-url="busyUrl"
      @add="addDiscovered"
      @close="closePicker"
    />

    <SaveArticleOverlay
      v-if="detectedArticle"
      :article="detectedArticle"
      :saving="savingArticle"
      @save="saveDetectedArticle"
      @close="detectedArticle = null"
    />
  </main>
</template>

<script setup lang="ts">
import type { Feed } from '~/types'
import type { DiscoveredFeedOption, DetectedArticle } from '~/composables/useFeeds'

const RESERVED = new Set(['shelf', 'sources', 'login', 'mcp-settings', 'article', 'found'])

const { feeds, feedsByTag, allTags, fetchFeeds, addFeed, smartAddFeed, deleteFeed, syncAll, updateFeedTags } = useFeeds()
const { markAllAsRead, fetchArticles } = useArticles()
const { user, signOut } = useAuth()
const { showSuccess, showError } = useToast()

const newUrl = ref('')
const adding = ref(false)
const syncing = ref(false)
const tagEditorFeed = ref<Feed | null>(null)

// Feed-picker state for when a site exposes several feeds
const discovered = ref<DiscoveredFeedOption[] | null>(null)
const addedUrls = ref<string[]>([])
const busyUrl = ref<string | null>(null)

// Save-as-article state for when the URL is an article page, not a feed
const detectedArticle = ref<DetectedArticle | null>(null)
const savingArticle = ref(false)

// Linked X account (bookmarks → Found)
type XLinkStatus = {
  available: boolean
  linked: boolean
  handle?: string | null
  lastSyncAt?: string | null
  lastError?: string | null
}
const xLink = ref<XLinkStatus | null>(null)

onMounted(() => {
  fetchFeeds()
  fetchXLink()
  // Returning from the OAuth dance: /sources?x=linked|error
  const result = useRoute().query.x
  if (result === 'linked') showSuccess('X account linked')
  else if (result === 'error') showError('Could not link the X account')
  if (result) navigateTo('/sources', { replace: true })
})

async function fetchXLink() {
  try {
    xLink.value = await $fetch<XLinkStatus>('/api/auth/x/link')
  } catch {
    xLink.value = null // signed out or unavailable — hide the block
  }
}

function linkX() {
  // Full navigation, not $fetch — the endpoint redirects to X's authorize page.
  window.location.href = '/api/auth/x/start'
}

async function unlinkX() {
  if (!window.confirm('Unlink your X account? Already-collected bookmarks stay in Found.')) return
  try {
    await $fetch('/api/auth/x/link', { method: 'DELETE' })
    await fetchXLink()
    showSuccess('X account unlinked')
  } catch { showError('Failed to unlink') }
}

async function add() {
  if (!newUrl.value || adding.value) return
  adding.value = true
  try {
    const res = await smartAddFeed(newUrl.value)
    if (res.type === 'feed_added') {
      showSuccess(`Added ${res.feed.title} — ${res.articlesAdded} articles`)
      newUrl.value = ''
    } else if (res.type === 'feed_exists') {
      showError(`Already subscribed to ${res.feed.title}`)
    } else if (res.type === 'feeds_discovered') {
      addedUrls.value = []
      discovered.value = res.feeds
    } else if (res.type === 'article_detected') {
      detectedArticle.value = res.article
    } else if (res.type === 'unknown') {
      detectedArticle.value = { title: res.suggestion.title, url: res.suggestion.url }
    } else {
      showError('No feed found at that URL')
    }
  } catch (err: any) {
    showError(err.data?.message || 'Could not find a feed at that URL')
  } finally {
    adding.value = false
  }
}

async function addDiscovered(feed: DiscoveredFeedOption) {
  if (busyUrl.value) return
  busyUrl.value = feed.url
  try {
    const res = await addFeed(feed.url)
    addedUrls.value = [...addedUrls.value, feed.url]
    showSuccess(`Added — ${res.articlesAdded} articles`)
  } catch (err: any) {
    if (err.statusCode === 409 || err.status === 409) {
      addedUrls.value = [...addedUrls.value, feed.url]
      showError('Already subscribed to that feed')
    } else {
      showError(err.data?.message || 'Could not add that feed')
    }
  } finally {
    busyUrl.value = null
  }
}

function closePicker() {
  if (addedUrls.value.length) newUrl.value = ''
  discovered.value = null
}

async function saveDetectedArticle() {
  const article = detectedArticle.value
  if (!article || savingArticle.value) return
  savingArticle.value = true
  try {
    await $fetch('/api/articles/manual', {
      method: 'POST',
      body: {
        title: article.title,
        url: article.url,
        content: article.content || undefined,
        summary: article.description || undefined,
        author: article.author || undefined,
        imageUrl: article.imageUrl || undefined
      }
    })
    detectedArticle.value = null
    newUrl.value = ''
    showSuccess('Saved to your shelf')
  } catch (err: any) {
    showError(err.data?.message || 'Could not save that article')
  } finally {
    savingArticle.value = false
  }
}

async function markRead(feedId: number) {
  try {
    await markAllAsRead(feedId)
    await fetchFeeds()
    showSuccess('Marked read')
  } catch { showError('Failed to mark read') }
}

function editTags(feed: Feed) {
  tagEditorFeed.value = feed
}

async function saveTags(tags: string[]) {
  const feed = tagEditorFeed.value
  tagEditorFeed.value = null
  if (!feed) return
  try {
    await updateFeedTags(feed.id, tags)
    showSuccess('Tags updated')
  } catch { showError('Failed to update tags') }
}

async function confirmDelete(feed: Feed) {
  if (!window.confirm(`Delete "${feed.title}" and all its articles?`)) return
  try {
    const res = await deleteFeed(feed.id)
    const n = res?.deletedArticles ?? 0
    showSuccess(n === 1 ? 'Deleted — 1 article' : `Deleted — ${n} articles`)
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

/* Feed row removal: fade + collapse so a deleted feed leaves the list cleanly */
.feed-row { transition: opacity .28s ease, transform .28s ease; }
.feed-row-leave-active { position: relative; }
.feed-row-leave-to { opacity: 0; transform: translateX(-12px); }
.feed-row-move { transition: transform .28s ease; }
@media (prefers-reduced-motion: reduce) {
  .feed-row, .feed-row-leave-active, .feed-row-move { transition: none; }
}
</style>
