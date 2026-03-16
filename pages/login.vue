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
            New or previously used Google login?
            <button @click="isSignUp = true; error = null" class="text-blue-600 dark:text-blue-400 hover:underline font-medium">Set up password</button>
          </template>
        </p>

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
const { loggedIn, signIn, signUp } = useAuth()
const loading = ref(false)
const error = ref<string | null>(null)
const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const name = ref('')

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
    error.value = err.data?.statusMessage || err.message || 'Authentication failed'
  } finally {
    loading.value = false
  }
}
</script>
