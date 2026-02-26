<template>
  <div class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-dark-bg dark:to-zinc-900 flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <!-- Logo/Title Card -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">The Librarian</h1>
        <p class="text-gray-600 dark:text-gray-400">Your friendly librarian for the web</p>
      </div>

      <!-- Login Card -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6 text-center">Sign in to continue</h2>

        <!-- Google Sign In Button -->
        <button
          @click="signInWithGoogle"
          :disabled="loading"
          class="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white dark:bg-zinc-800 border-2 border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 hover:border-gray-400 dark:hover:border-zinc-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          <span class="font-medium text-gray-700 dark:text-gray-300">
            {{ loading ? 'Signing in...' : 'Continue with Google' }}
          </span>
        </button>

        <!-- Info Text -->
        <p class="mt-6 text-sm text-gray-500 dark:text-gray-400 text-center">
          By signing in, you agree to our Terms of Service and Privacy Policy
        </p>

        <!-- Error Message -->
        <div v-if="error" class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>
      </div>

      <!-- Features -->
      <div class="mt-8 text-center">
        <p class="text-sm text-gray-600 dark:text-gray-400 mb-4">Why The Librarian?</p>
        <div class="grid grid-cols-3 gap-4 text-xs text-gray-500 dark:text-gray-400">
          <div>
            <div class="text-2xl mb-1">🔒</div>
            <div>Private & Secure</div>
          </div>
          <div>
            <div class="text-2xl mb-1">⚡</div>
            <div>Fast & Lightweight</div>
          </div>
          <div>
            <div class="text-2xl mb-1">📱</div>
            <div>Works Anywhere</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({
  auth: false
})

const { signIn, status, data: session } = useAuth()
const loading = ref(false)
const error = ref<string | null>(null)

// Redirect if already authenticated
watch([status, session], ([newStatus, newSession]) => {
  if (newStatus === 'authenticated' && newSession?.user) {
    navigateTo('/')
  }
}, { immediate: true })

const signInWithGoogle = async () => {
  loading.value = true
  error.value = null

  try {
    await signIn('google', { callbackUrl: '/' })
  } catch (err: any) {
    error.value = 'Failed to sign in with Google. Please try again.'
    console.error('Sign in error:', err)
  } finally {
    loading.value = false
  }
}
</script>
