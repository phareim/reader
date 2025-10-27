<template>
  <div class="flex items-center justify-between px-6 py-4 h-16 border-b border-gray-200 dark:border-zinc-800 flex-shrink-0">
    <button
      @click="$emit('close')"
      class="p-2 hover:bg-gray-100 dark:hover:bg-zinc-800 rounded-lg transition-colors text-gray-900 dark:text-gray-100"
      aria-label="Close menu"
    >
      <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>
    <NuxtLink
      to="/"
      class="text-2xl font-bold text-gray-900 dark:text-gray-100 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
    >
      Vibe Reader
    </NuxtLink>
    <img v-if="session?.user?.image" :src="session.user.image" :alt="session.user.name"
      class="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-zinc-700" />
    <div v-else
      class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 dark:from-blue-600 dark:to-purple-600 flex items-center justify-center text-white font-semibold text-sm">
      {{ session?.user?.name?.charAt(0) || '?' }}
    </div>
  </div>
</template>

<script setup lang="ts">
const { data: session } = useAuth()

defineEmits(['close', 'select-all-feeds'])
</script>
