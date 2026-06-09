<template>
  <nav
    v-if="visible"
    class="fixed bottom-0 inset-x-0 z-40 border-t border-rule bg-paper"
    style="padding-bottom: env(safe-area-inset-bottom);"
  >
    <div class="mx-auto max-w-measure flex">
      <NuxtLink
        v-for="room in rooms"
        :key="room.path"
        :to="room.path"
        class="flex-1 py-3 text-center font-mono uppercase"
        style="font-size: 10px; letter-spacing: 0.16em;"
        :class="isActive(room.path) ? 'text-accent-ink' : 'text-mute'"
      >{{ room.label }}</NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute()

const rooms = [
  { path: '/', label: 'Deck' },
  { path: '/shelf', label: 'Shelf' },
  { path: '/sources', label: 'Sources' },
]

const visible = computed(() =>
  !route.path.startsWith('/article') && route.path !== '/login'
)

function isActive(path: string) {
  return path === '/' ? route.path === '/' : route.path.startsWith(path)
}
</script>
