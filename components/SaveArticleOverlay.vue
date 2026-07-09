<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-50 overflow-y-auto bg-paper" role="dialog" aria-modal="true" aria-label="Save article">
      <div class="mx-auto max-w-measure px-5 py-6">
        <header class="flex items-baseline justify-between gap-3">
          <MonoLabel dash>No feed here</MonoLabel>
        </header>
        <HairlineRule class="mt-3 mb-5" />

        <p class="text-mute">This looks like an article, not a feed. Save it to your shelf instead?</p>

        <div class="mt-5">
          <div class="text-xl text-ink">{{ article.title }}</div>
          <div v-if="article.author" class="mt-1 text-body">{{ article.author }}</div>
          <div class="article-url mt-2 truncate">{{ article.url }}</div>
          <p v-if="article.description" class="mt-3 text-body">{{ article.description }}</p>
        </div>

        <HairlineRule class="mt-8" />
        <div class="mt-4 flex justify-end gap-3">
          <ActionLabel :disabled="saving" @click="emit('close')">Cancel</ActionLabel>
          <ActionLabel accent :disabled="saving" @click="emit('save')">{{ saving ? 'Saving…' : 'Save article' }}</ActionLabel>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { DetectedArticle } from '~/composables/useFeeds'

defineProps<{ article: DetectedArticle; saving: boolean }>()
const emit = defineEmits<{ save: []; close: [] }>()

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
.article-url {
  font-family: 'SF Mono', ui-monospace, Menlo, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--text-muted);
}
</style>
