<template>
  <div class="min-h-screen bg-paper text-ink font-serif">
    <NuxtPage />
    <BottomBar />
    <AppToast />
    <ClientOnly>
      <PwaUpdatePrompt />
    </ClientOnly>
  </div>
</template>
