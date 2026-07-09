<template>
  <main class="flex min-h-screen items-center justify-center px-5">
    <div class="w-full max-w-sm">
      <MonoLabel dash>The Reader</MonoLabel>
      <h1 class="mt-2 text-3xl">{{ isSignUp ? 'Create account' : 'Sign in' }}</h1>
      <HairlineRule class="mt-4 mb-6" />

      <form @submit.prevent="handleSubmit" class="space-y-5">
        <div v-if="isSignUp">
          <label for="name"><MonoLabel>Name</MonoLabel></label>
          <input id="name" v-model="name" type="text" autocomplete="name" class="tufte-input" />
        </div>
        <div>
          <label for="email"><MonoLabel>Email</MonoLabel></label>
          <input id="email" v-model="email" type="email" required autocomplete="email" class="tufte-input" />
        </div>
        <div>
          <label for="password"><MonoLabel>Password</MonoLabel></label>
          <input
            id="password" v-model="password" type="password" required :minlength="isSignUp ? 12 : undefined"
            :autocomplete="isSignUp ? 'new-password' : 'current-password'" class="tufte-input"
          />
          <p v-if="isSignUp" class="mt-1 text-mute" style="font-size: 12px;">
            At least 12 characters, with a letter and a digit.
          </p>
        </div>
        <div v-if="isSignUp">
          <label for="invite"><MonoLabel>Invite code</MonoLabel></label>
          <input id="invite" v-model="inviteCode" type="text" required autocomplete="off" class="tufte-input" />
        </div>

        <p v-if="error" class="text-sm text-accent-ink">{{ error }}</p>

        <div class="flex items-center justify-between pt-2">
          <ActionLabel accent :disabled="loading" @click="handleSubmit">
            {{ loading ? 'Working…' : isSignUp ? 'Sign up' : 'Sign in' }}
          </ActionLabel>
          <button type="button" class="font-mono uppercase text-mute"
            style="font-size: 10px; letter-spacing: 0.16em;"
            @click="isSignUp = !isSignUp; error = null">
            {{ isSignUp ? 'Have an account?' : 'New here?' }}
          </button>
        </div>
      </form>
    </div>
  </main>
</template>

<script setup lang="ts">
const { loggedIn, signIn, signUp } = useAuth()
const route = useRoute()
const loading = ref(false)
const error = ref<string | null>(null)
const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const name = ref('')
const inviteCode = ref('')

// Reader is the identity provider for sibling apps on *.phareim.no —
// they bounce here with ?redirect=<url back>. Only phareim.no targets
// (or local paths) are honored, so the param can't be an open redirect.
function safeRedirect(raw: unknown): string {
  if (typeof raw !== 'string' || raw === '') return '/'
  try {
    const url = new URL(raw)
    if (
      url.protocol === 'https:' &&
      (url.hostname === 'phareim.no' || url.hostname.endsWith('.phareim.no'))
    ) {
      return url.href
    }
    return '/'
  } catch {
    // Not an absolute URL — allow app-local paths only.
    return raw.startsWith('/') && !raw.startsWith('//') ? raw : '/'
  }
}

function goToTarget() {
  const target = safeRedirect(route.query.redirect)
  return navigateTo(target, { external: target.startsWith('https://') })
}

// Redirect if already authenticated
watch(loggedIn, (isLoggedIn) => {
  if (isLoggedIn) {
    goToTarget()
  }
}, { immediate: true })

const handleSubmit = async () => {
  if (loading.value) return
  loading.value = true
  error.value = null

  try {
    if (isSignUp.value) {
      await signUp(email.value, password.value, name.value || undefined, inviteCode.value)
    } else {
      await signIn(email.value, password.value)
    }
    await goToTarget()
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
