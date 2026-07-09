<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-label="Choose a feed">
      <div class="mx-auto max-w-measure px-5 py-6">
        <header class="flex items-baseline justify-between gap-3">
          <MonoLabel dash>Feeds found</MonoLabel>
          <MonoLabel>{{ feeds.length }}</MonoLabel>
        </header>
        <HairlineRule class="mt-3 mb-2" />
        <p class="text-mute">{{ sourceHost }} offers more than one feed — pick the ones you want.</p>

        <ul class="mt-4">
          <li v-for="feed in feeds" :key="feed.url" class="feed-option border-b border-rule py-3 last:border-0">
            <div class="flex items-center justify-between gap-3">
              <div class="min-w-0">
                <div class="truncate text-lg text-ink">{{ feed.title }}</div>
                <div class="feed-url truncate">{{ feed.url }}</div>
              </div>
              <MonoLabel v-if="isAdded(feed)" class="shrink-0">&mdash;&nbsp;Added</MonoLabel>
              <ActionLabel
                v-else
                accent
                class="shrink-0"
                :disabled="busyUrl !== null"
                @click="emit('add', feed)"
              >{{ busyUrl === feed.url ? 'Adding…' : 'Add' }}</ActionLabel>
            </div>
          </li>
        </ul>

        <HairlineRule class="mt-8" />
        <div class="mt-4 flex justify-end">
          <ActionLabel @click="emit('close')">{{ addedUrls.length ? 'Done' : 'Cancel' }}</ActionLabel>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { DiscoveredFeedOption } from '~/composables/useFeeds'

const props = defineProps<{
  feeds: DiscoveredFeedOption[]
  addedUrls: string[]
  busyUrl: string | null
}>()
const emit = defineEmits<{ add: [feed: DiscoveredFeedOption]; close: [] }>()

const sourceHost = computed(() => {
  try {
    return new URL(props.feeds[0]?.url || '').host.replace(/^www\./, '')
  } catch {
    return 'This site'
  }
})

function isAdded(feed: DiscoveredFeedOption) {
  return props.addedUrls.includes(feed.url)
}

function onWindowKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onWindowKey))
onUnmounted(() => window.removeEventListener('keydown', onWindowKey))
</script>

<style scoped>
.feed-url {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
</style>
