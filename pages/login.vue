<template>
  <div class="relative min-h-screen bg-paper text-ink font-serif flex items-center justify-center p-almanac-gutter overflow-hidden">
    <!-- Starfield, dark mode only -->
    <div class="starfield-dark pointer-events-none absolute inset-0 z-0" aria-hidden="true">
      <Starfield />
    </div>

    <div class="relative z-10 w-full max-w-sm">
      <!-- Mark + welcome -->
      <div class="flex flex-col items-center text-center mb-almanac-gutter">
        <OrbitalGlyph :size="56" />
        <MonoLabel as="span" class="mt-4">The Librarian</MonoLabel>
        <SerifHeadline level="h1" class="mt-3">
          {{ isSignUp ? 'Create your account' : 'Welcome back' }}
        </SerifHeadline>
        <p class="text-mute text-[14px] leading-[1.55] mt-2 italic">
          Your friendly librarian for the web.
        </p>
      </div>

      <HeaderDivider />

      <!-- Form -->
      <form @submit.prevent="handleSubmit" class="space-y-almanac-gutter mt-almanac-gutter">
        <div v-if="isSignUp" class="space-y-1">
          <label for="name"><MonoLabel as="span">Name</MonoLabel></label>
          <input
            id="name"
            v-model="name"
            type="text"
            autocomplete="name"
            class="almanac-input"
            placeholder="Your name"
          />
        </div>

        <div class="space-y-1">
          <label for="email"><MonoLabel as="span">Email</MonoLabel></label>
          <input
            id="email"
            v-model="email"
            type="email"
            required
            autocomplete="email"
            class="almanac-input"
            placeholder="you@example.com"
          />
        </div>

        <div class="space-y-1">
          <label for="password"><MonoLabel as="span">Password</MonoLabel></label>
          <input
            id="password"
            v-model="password"
            type="password"
            required
            :autocomplete="isSignUp ? 'new-password' : 'current-password'"
            class="almanac-input"
            placeholder="Your password"
            minlength="8"
          />
        </div>

        <div class="pt-2">
          <ActionLabel
            :label="loading ? 'PLEASE WAIT' : (isSignUp ? 'CREATE ACCOUNT' : 'SIGN IN')"
            accent
            :disabled="loading"
            @click="handleSubmit"
          />
        </div>
      </form>

      <!-- Toggle sign in / sign up -->
      <p class="mt-almanac-gutter text-[13px] text-mute italic leading-[1.55]">
        <template v-if="isSignUp">
          Already have an account?
          <button type="button" @click="isSignUp = false; error = null" class="text-ink underline underline-offset-2 hover:text-rust">Sign in</button>
        </template>
        <template v-else>
          New or previously used Google login?
          <button type="button" @click="isSignUp = true; error = null" class="text-ink underline underline-offset-2 hover:text-rust">Set up a password</button>
        </template>
      </p>

      <!-- Error -->
      <div v-if="error" class="mt-almanac-section-gap border-t border-rule pt-almanac-section-gap">
        <p class="text-[13px] text-rust italic">{{ error }}</p>
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
/* Hairline-underlined input — no box, no radius, no shadow. */
.almanac-input {
  width: 100%;
  background: transparent;
  border: 0;
  border-bottom: 1px solid var(--almanac-rule-line);
  color: var(--almanac-fg);
  font-family: var(--almanac-serif, "Source Serif 4", Georgia, serif);
  font-size: 16px;
  line-height: 1.55;
  padding: 6px 0;
  outline: none;
  transition: border-color 0.15s ease;
}
.almanac-input::placeholder {
  color: var(--almanac-fg-mute);
  opacity: 0.7;
}
.almanac-input:focus {
  border-bottom-color: var(--almanac-accent);
}

/* Starfield only in dark mode. */
.starfield-dark { display: none; }
@media (prefers-color-scheme: dark) {
  .starfield-dark { display: block; }
}
</style>
