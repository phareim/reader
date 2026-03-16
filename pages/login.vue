<template>
  <div
    class="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 dark:from-dark-bg dark:to-zinc-900 flex items-center justify-center p-4">
    <div class="max-w-md w-full">
      <!-- Logo/Title Card -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">Reader</h1>
        <p class="text-gray-600 dark:text-gray-400">Your friendly librarian for the web</p>
      </div>

      <!-- Login Card -->
      <div class="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100 mb-6 text-center">
          {{ isSignUp ? 'Create account' : 'Sign in' }}
        </h2>

        <!-- Email/Password Form -->
        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div v-if="isSignUp">
            <label for="name" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              id="name"
              v-model="name"
              type="text"
              autocomplete="name"
              class="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Your name"
            />
          </div>

          <div>
            <label for="email" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email</label>
            <input
              id="email"
              v-model="email"
              type="email"
              required
              autocomplete="email"
              class="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label for="password" class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password</label>
            <input
              id="password"
              v-model="password"
              type="password"
              required
              :autocomplete="isSignUp ? 'new-password' : 'current-password'"
              class="w-full px-4 py-2.5 border border-gray-300 dark:border-zinc-700 rounded-lg bg-white dark:bg-zinc-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
              placeholder="Your password"
              minlength="8"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {{ loading ? 'Please wait...' : (isSignUp ? 'Create account' : 'Sign in') }}
          </button>
        </form>

        <!-- Toggle sign in / sign up -->
        <p class="mt-4 text-center text-sm text-gray-600 dark:text-gray-400">
          <template v-if="isSignUp">
            Already have an account?
            <button @click="isSignUp = false; error = null" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">Sign in</button>
          </template>
          <template v-else>
            Don't have an account?
            <button @click="isSignUp = true; error = null" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">Create one</button>
          </template>
        </p>

        <!-- Divider -->
        <div class="relative my-6">
          <div class="absolute inset-0 flex items-center">
            <div class="w-full border-t border-gray-300 dark:border-zinc-700"></div>
          </div>
          <div class="relative flex justify-center text-sm">
            <span class="px-2 bg-white dark:bg-zinc-900 text-gray-500">or</span>
          </div>
        </div>

        <!-- Google Sign In Button -->
        <button @click="signInWithGoogle" :disabled="loading"
          class="w-full flex items-center justify-center gap-3 px-6 py-2.5 bg-white dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-lg hover:bg-gray-50 dark:hover:bg-zinc-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed">
          <svg class="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span class="font-medium text-gray-700 dark:text-gray-300">Continue with Google</span>
        </button>

        <!-- Error Message -->
        <div v-if="error"
          class="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p class="text-sm text-red-600 dark:text-red-400">{{ error }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
const { loggedIn, signIn, signUp, signInWithGoogle } = useAuth()
const loading = ref(false)
const error = ref<string | null>(null)
const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const name = ref('')

// Check for error query param
const route = useRoute()
if (route.query.error) {
  error.value = String(route.query.error)
}

// Redirect if already authenticated
watch(loggedIn, (isLoggedIn) => {
  if (isLoggedIn) {
    navigateTo('/')
  }
}, { immediate: true })

const handleSubmit = async () => {
  loading.value = true
  error.value = null

  try {
    if (isSignUp.value) {
      await signUp(email.value, password.value, name.value || undefined)
    } else {
      await signIn(email.value, password.value)
    }
    navigateTo('/')
  } catch (err: any) {
    error.value = err.message || 'Authentication failed'
  } finally {
    loading.value = false
  }
}
</script>
