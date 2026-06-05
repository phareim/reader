<template>
  <div class="dropdown-menu-container absolute right-0 mt-1 w-64 bg-paper border border-rule z-50">
    <button @click="$emit('mark-as-read')"
      class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-ink hover:text-rust transition-colors flex items-center gap-2">
      <svg class="w-4 h-4 text-mute" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Mark all as read</span>
    </button>

    <!-- Tags Management -->
    <div class="px-almanac-gutter py-3 border-t border-rule">
      <MonoLabel as="div">TAGS</MonoLabel>

      <!-- Current Tags -->
      <div v-if="feed.tags && feed.tags.length > 0" class="flex flex-wrap gap-1.5 mt-2 mb-3">
        <button v-for="feedTag in feed.tags" :key="feedTag"
          @click="$emit('remove-tag', feedTag)"
          class="group flex items-center gap-1 font-serif text-[13px] px-1.5 py-0.5 border border-rule text-ink hover:text-rust hover:border-rust transition-colors"
          title="Click to remove">
          <span>#{{ feedTag }}</span>
          <svg class="w-3 h-3 opacity-50 group-hover:opacity-100" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
              d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p v-else class="mt-2 mb-3 font-serif text-[13px] italic text-mute">No tags yet</p>

      <!-- Add Tag Input with Autocomplete -->
      <TagInput
        placeholder="Add tag (3+ chars for suggestions)"
        :existing-tags="feed.tags"
        :all-tags="allTags"
        @add-tag="(tag) => $emit('add-tag', tag)"
        @click.stop
      />
    </div>

    <button @click="$emit('delete-feed')"
      class="w-full text-left px-almanac-gutter py-2.5 font-serif text-[14px] text-mute hover:text-rust transition-colors flex items-center gap-2 border-t border-rule">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5"
          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
      </svg>
      <span>Delete feed</span>
    </button>
  </div>
</template>

<script setup lang="ts">
interface Feed {
  id: number
  title: string
  tags: string[]
}

defineProps<{
  feed: Feed
  allTags: Array<{ tag: string; count: number }>
}>()

defineEmits(['mark-as-read', 'add-tag', 'remove-tag', 'delete-feed'])
</script>
