<template>
  <main class="mx-auto max-w-measure px-5 py-6 pb-24">
    <header class="flex items-baseline justify-between">
      <MonoLabel dash>Sources</MonoLabel>
      <div class="flex items-baseline gap-4">
        <ClientOnly>
          <div class="flex items-baseline gap-2">
            <button class="src-action" :disabled="atMin" aria-label="Smaller text" @click="decrease">A−</button>
            <MonoLabel>{{ textSize }}%</MonoLabel>
            <button class="src-action" :disabled="atMax" aria-label="Larger text" @click="increase">A+</button>
          </div>
        </ClientOnly>
        <NuxtLink to="/discover" class="focus-visible:outline focus-visible:outline-1">
          <MonoLabel>Discover</MonoLabel>
        </NuxtLink>
        <MonoLabel>{{ feeds.length }} feeds</MonoLabel>
      </div>
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
              class="flex min-w-0 items-center gap-2 text-lg text-ink hover:text-accent-ink focus-visible:outline focus-visible:outline-1"
            >
              <FeedFavicon :src="feed.faviconUrl" :size="14" />
              <span class="truncate">{{ feed.title }}</span>
            </NuxtLink>
            <MonoLabel>{{ feed.unreadCount }}</MonoLabel>
          </div>
          <p v-if="feedHealthNote(feed)" class="mt-0.5 text-sm italic text-mute">
            {{ feedHealthNote(feed) }}
          </p>
          <div class="mt-1.5 flex gap-4">
            <button
              v-if="(feed.kind ?? 'rss') === 'rss'"
              class="src-action"
              @click="syncFeed(feed)"
            >{{ syncingFeedId === feed.id ? 'Syncing…' : 'Sync' }}</button>
            <button class="src-action" @click="markRead(feed.id)">Mark read</button>
            <button class="src-action" @click="editTags(feed)">Tags</button>
            <button class="src-action hover:text-accent-ink" @click="confirmDelete(feed)">Delete</button>
          </div>
        </li>
      </TransitionGroup>
    </section>

    <!-- Linked sources (X / Reddit / Hacker News → Found). Rows for
         unconfigured OAuth clients are hidden by `available`. -->
    <section v-if="visibleLinks.length" class="mt-10">
      <MonoLabel dash>Linked sources</MonoLabel>
      <div
        v-for="link in visibleLinks" :key="link.source"
        class="mt-3 flex flex-wrap items-baseline justify-between gap-3 border-b border-rule pb-3"
      >
        <template v-if="link.linked">
          <div class="min-w-0">
            <span class="text-lg text-ink">{{ SOURCE_META[link.source].prefix }}{{ link.handle }}</span>
            <MonoLabel class="ml-2">{{ SOURCE_META[link.source].name }}</MonoLabel>
            <p class="mt-1 text-sm text-mute">
              <template v-if="link.lastError">Sync failing — try relinking.</template>
              <template v-else-if="link.lastSyncAt">{{ SOURCE_META[link.source].things }} synced {{ formatRelativeDate(link.lastSyncAt) }}.</template>
              <template v-else>Linked — {{ SOURCE_META[link.source].things.toLowerCase() }} land in Found on the next sync.</template>
            </p>
          </div>
          <div class="flex items-center gap-4">
            <ActionLabel v-if="link.lastError && !isUsernameSource(link.source)" accent @click="linkSource(link.source)">Relink</ActionLabel>
            <button class="src-action" @click="unlinkSource(link.source)">Unlink</button>
          </div>
        </template>
        <template v-else-if="isUsernameSource(link.source)">
          <div class="min-w-0 flex-1">
            <p class="text-sm text-mute">{{ SOURCE_META[link.source].pitch }}</p>
            <form class="mt-1 flex items-end gap-3" @submit.prevent="linkByUsername(link.source)">
              <input
                v-model="usernames[link.source]" type="text" autocapitalize="off" autocorrect="off" spellcheck="false"
                :placeholder="SOURCE_META[link.source].placeholder"
                class="w-44 border-0 border-b border-rule bg-transparent py-1 text-ink outline-none focus:border-accent"
              />
              <ActionLabel :disabled="linkingUsername === link.source || !usernames[link.source]?.trim()" @click="linkByUsername(link.source)">
                {{ linkingUsername === link.source ? 'Linking…' : 'Link' }}
              </ActionLabel>
            </form>
          </div>
        </template>
        <template v-else>
          <p class="text-sm text-mute">{{ SOURCE_META[link.source].pitch }}</p>
          <ActionLabel @click="linkSource(link.source)">Link {{ SOURCE_META[link.source].name }}</ActionLabel>
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
import { feedHealthNote } from '~/utils/feedHealth'

const RESERVED = new Set(['shelf', 'sources', 'login', 'mcp-settings', 'article', 'found', 'highlights', 'search', 'discover', 'good-reads'])

const { feeds, feedsByTag, allTags, fetchFeeds, addFeed, smartAddFeed, deleteFeed, syncAll, refreshFeed, updateFeedTags } = useFeeds()
const { markAllAsRead, fetchArticles } = useArticles()
const { user, signOut } = useAuth()
const { showSuccess, showError } = useToast()

// Global text-size preference (scales the root font-size — see useTextSize)
const { textSize, increase, decrease } = useTextSize()
const atMin = computed(() => textSize.value <= TEXT_SIZE.MIN)
const atMax = computed(() => textSize.value >= TEXT_SIZE.MAX)

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

// Linked sources (X / Reddit / Hacker News / GitHub → Found)
type SourceLink = {
  source: 'x' | 'reddit' | 'hackernews' | 'github'
  available: boolean
  linked: boolean
  handle?: string | null
  lastSyncAt?: string | null
  lastError?: string | null
}
const SOURCE_META = {
  x: { name: 'X', prefix: '@', things: 'Bookmarks', pitch: 'Bring your X bookmarks into the Found feed.' },
  reddit: { name: 'Reddit', prefix: 'u/', things: 'Saved items', pitch: 'Bring your saved Reddit posts and comments into Found.' },
  hackernews: { name: 'Hacker News', prefix: '', things: 'Favorites', pitch: 'Bring your public Hacker News favorites into Found.', placeholder: 'HN username' },
  github: { name: 'GitHub', prefix: '', things: 'Stars', pitch: 'Bring your public GitHub stars into Found.', placeholder: 'GitHub username' },
} as const

// Public sources linked by a username form — no OAuth dance.
type UsernameSource = 'hackernews' | 'github'
const isUsernameSource = (s: SourceLink['source']): s is UsernameSource =>
  s === 'hackernews' || s === 'github'

const sourceLinks = ref<SourceLink[]>([])
const visibleLinks = computed(() => sourceLinks.value.filter((l) => l.available))
const usernames = reactive<Record<UsernameSource, string>>({ hackernews: '', github: '' })
const linkingUsername = ref<UsernameSource | null>(null)

onMounted(() => {
  fetchFeeds()
  fetchSourceLinks()
  // Returning from an OAuth dance: /sources?linked=<source>|error=<source>
  const q = useRoute().query
  const linkedSource = q.linked as keyof typeof SOURCE_META | undefined
  const errorSource = q.error as keyof typeof SOURCE_META | undefined
  if (linkedSource && SOURCE_META[linkedSource]) showSuccess(`${SOURCE_META[linkedSource].name} account linked`)
  else if (errorSource && SOURCE_META[errorSource]) showError(`Could not link the ${SOURCE_META[errorSource].name} account`)
  if (linkedSource || errorSource) navigateTo('/sources', { replace: true })
})

async function fetchSourceLinks() {
  try {
    const res = await $fetch<{ sources: SourceLink[] }>('/api/sources/links')
    sourceLinks.value = res.sources
  } catch {
    sourceLinks.value = [] // signed out — hide the section
  }
}

function linkSource(source: SourceLink['source']) {
  // Full navigation, not $fetch — the endpoint redirects to the provider's
  // authorize page.
  window.location.href = `/api/auth/${source}/start`
}

async function linkByUsername(source: UsernameSource) {
  const username = usernames[source].trim()
  const name = SOURCE_META[source].name
  if (!username || linkingUsername.value) return
  linkingUsername.value = source
  try {
    const res = await $fetch<{ handle: string }>(`/api/sources/links/${source}`, {
      method: 'POST',
      body: { username }
    })
    usernames[source] = ''
    await fetchSourceLinks()
    showSuccess(`Linked ${name} as ${res.handle}`)
  } catch (err: any) {
    showError(err.statusCode === 404 || err.status === 404 ? `No such ${name} user` : `Could not link ${name}`)
  } finally {
    linkingUsername.value = null
  }
}

async function unlinkSource(source: SourceLink['source']) {
  const meta = SOURCE_META[source]
  if (!window.confirm(`Unlink ${meta.name}? Already-collected items stay in Found.`)) return
  try {
    await $fetch(`/api/sources/links/${source}`, { method: 'DELETE' })
    await fetchSourceLinks()
    showSuccess(`${meta.name} unlinked`)
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

const syncingFeedId = ref<number | null>(null)

async function syncFeed(feed: Feed) {
  if (syncingFeedId.value !== null) return
  syncingFeedId.value = feed.id
  try {
    const res = await refreshFeed(feed.id)
    const n = res?.newArticles ?? 0
    showSuccess(n === 0 ? 'No new articles' : n === 1 ? '1 new article' : `${n} new articles`)
  } catch { showError('Sync failed') }
  finally { syncingFeedId.value = null }
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
.src-action:disabled { opacity: 0.35; pointer-events: none; }

/* Feed row removal: fade + collapse so a deleted feed leaves the list cleanly */
.feed-row { transition: opacity .28s ease, transform .28s ease; }
.feed-row-leave-active { position: relative; }
.feed-row-leave-to { opacity: 0; transform: translateX(-12px); }
.feed-row-move { transition: transform .28s ease; }
@media (prefers-reduced-motion: reduce) {
  .feed-row, .feed-row-leave-active, .feed-row-move { transition: none; }
}
</style>
