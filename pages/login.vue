<template>
  <main class="flex min-h-screen items-center justify-center px-5">
    <div class="w-full max-w-sm">
      <MonoLabel dash>The Reader</MonoLabel>
      <h1 class="mt-2 text-3xl">{{ isSignUp ? 'Create account' : 'Sign in' }}</h1>
      <HairlineRule class="mt-4 mb-6" />

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div v-if="isSignUp">
          <MonoLabel>Name</MonoLabel>
          <input v-model="name" type="text" autocomplete="name" class="tufte-input" />
        </div>
        <div>
          <MonoLabel>Email</MonoLabel>
          <input v-model="email" type="email" required autocomplete="email" class="tufte-input" />
        </div>
        <div>
          <MonoLabel>Password</MonoLabel>
          <input
            v-model="password" type="password" required
            :autocomplete="isSignUp ? 'new-password' : 'current-password'" class="tufte-input"
          />
        </div>

        <p v-if="error" class="text-sm text-accent-ink">{{ error }}</p>

        <div class="flex items-center justify-between pt-2">
          <ActionLabel accent :disabled="loading" @click="handleSubmit">
            {{ loading ? 'Working…' : isSignUp ? 'Sign up' : 'Sign in' }}
          </ActionLabel>
          <button type="button" class="font-mono uppercase text-mute"
            style="font-size: 10px; letter-spacing: 0.16em;"
            @click="isSignUp = !isSignUp">
            {{ isSignUp ? 'Have an account?' : 'New here?' }}
          </button>
        </div>
      </form>
    </div>
  </main>
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
  if (loading.value) return
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

<style scoped>
.tufte-input {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--border-rule);
  color: var(--text-strong);
  font-family: 'et-book', Charter, Georgia, serif;
  font-size: 16px;
  line-height: 1.55;
  padding: 6px 0;
  outline: none;
}
.tufte-input:focus { border-bottom-color: var(--tufte-accent); }
</style>
