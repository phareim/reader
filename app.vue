<template>
  <div class="min-h-screen bg-paper text-ink font-serif">
    <NuxtPage />
    <BottomBar />
    <AppToast />
    <CommandPalette />
    <ClientOnly>
      <PwaUpdatePrompt />
    </ClientOnly>
  </div>
</template>
