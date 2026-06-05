<template>
  <div class="flex items-center justify-between px-almanac-gutter py-4 h-16 border-b border-rule flex-shrink-0">
    <button
      @click="$emit('close')"
      class="p-2 -ml-2 text-ink/70 hover:text-ink transition-colors"
      aria-label="Close menu"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <NuxtLink to="/" class="group">
      <SerifHeadline level="h3">The Librarian</SerifHeadline>
    </NuxtLink>
    <img v-if="user?.image" :src="user.image" :alt="user.name"
      class="w-8 h-8 border border-rule" />
    <div v-else
      class="w-8 h-8 border border-rule flex items-center justify-center text-ink font-serif text-sm">
      {{ user?.name?.charAt(0) || '?' }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { user } = useAuth()

defineEmits(['close', 'select-all-feeds'])
</script>
