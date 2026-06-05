<template>
  <div class="px-almanac-gutter py-almanac-gutter font-serif text-ink">
    <!-- No feeds at all -->
    <div v-if="type === 'no-feeds'" class="max-w-almanac-measure mx-auto text-center">
      <div class="flex flex-col items-center">
        <OrbitalGlyph :size="56" />
        <MonoLabel as="span" class="mt-4">Get Started</MonoLabel>
        <SerifHeadline level="h1" class="mt-3">No feeds yet</SerifHeadline>
        <p class="text-mute text-[14px] leading-[1.55] mt-2 italic">
          Add your first feed to begin reading.
        </p>
      </div>

      <div class="mt-almanac-gutter text-left">
        <FeedUrlInput size="large" @success="handleFeedSuccess" @error="handleFeedError" />
        <p v-if="feedError" class="mt-2 text-[13px] text-rust italic">{{ feedError }}</p>
        <p v-if="feedSuccess" class="mt-2 text-[13px] text-mute italic">{{ feedSuccess }}</p>
      </div>
    </div>

    <!-- All caught up -->
    <div v-else-if="type === 'all-caught-up'" class="max-w-almanac-measure mx-auto">
      <div class="text-center mb-almanac-gutter">
        <MonoLabel as="span">Overview</MonoLabel>
        <SerifHeadline level="h1" class="mt-2">
          {{ totalUnreadCount }} unread {{ totalUnreadCount === 1 ? 'article' : 'articles' }}
        </SerifHeadline>
      </div>

      <HeaderDivider />

      <div v-show="hasUnreadInOtherViews" class="mt-almanac-gutter">
        <!-- Tags with unread articles -->
        <NuxtLink
          v-for="tag in tagsWithUnread"
          :key="tag.name"
          :to="`/tag/${tag.name}`"
          class="group flex items-center justify-between py-almanac-section-gap border-b border-rule transition-colors"
        >
          <div class="flex items-baseline gap-2">
            <span class="text-mute">#</span>
            <SerifHeadline level="h3" class="group-hover:text-rust transition-colors">{{ tag.name }}</SerifHeadline>
          </div>
          <span class="text-[13px] text-mute italic">{{ tag.unreadCount }} unread</span>
        </NuxtLink>

        <!-- Inbox with unread articles -->
        <NuxtLink
          v-if="inboxUnreadCount > 0"
          to="/tag/__inbox__"
          class="group flex items-center justify-between py-almanac-section-gap border-b border-rule transition-colors"
        >
          <div class="flex items-baseline gap-2">
            <span class="text-mute">·</span>
            <SerifHeadline level="h3" class="group-hover:text-rust transition-colors">Inbox</SerifHeadline>
          </div>
          <span class="text-[13px] text-mute italic">{{ inboxUnreadCount }} unread</span>
        </NuxtLink>

        <!-- If no unread at all -->
        <div v-if="totalUnreadCount === 0" class="text-center py-almanac-gutter">
          <p class="text-mute text-[14px] italic mb-almanac-section-gap">
            You're all caught up.
          </p>
          <div class="flex justify-center">
            <ActionLabel label="SYNC ALL" accent @click="$emit('sync-all')" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Tag {
  name: string
  unreadCount: number
}

interface Props {
  type: 'no-feeds' | 'all-caught-up'
  tagsWithUnread?: Tag[]
  inboxUnreadCount?: number
  totalUnreadCount?: number
  hasUnreadInOtherViews?: boolean
}

withDefaults(defineProps<Props>(), {
  tagsWithUnread: () => [],
  inboxUnreadCount: 0,
  totalUnreadCount: 0,
  hasUnreadInOtherViews: false
})

defineEmits<{
  'sync-all': []
}>()

const feedError = ref<string | null>(null)
const feedSuccess = ref<string | null>(null)

const handleFeedSuccess = (message: string) => {
  feedError.value = null
  feedSuccess.value = message
  setTimeout(() => {
    feedSuccess.value = null
  }, 3000)
}

const handleFeedError = (message: string) => {
  feedSuccess.value = null
  feedError.value = message
  setTimeout(() => {
    feedError.value = null
  }, 3000)
}
</script>
