<template>
  <div class="min-h-screen text-ink font-serif">
    <NuxtPage />
    <BottomBar />
    <AppToast />
    <CommandPalette />
    <ClientOnly>
      <PwaUpdatePrompt />
    </ClientOnly>
  </div>
</template>
