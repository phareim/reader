<template>
  <Teleport to="body">
    <div
      class="fixed inset-0 z-50 flex flex-col bg-paper"
      role="dialog"
      aria-modal="true"
      aria-label="Speed read"
    >
      <div class="mx-auto flex w-full max-w-measure flex-1 flex-col px-5 py-6">
        <header class="flex items-baseline justify-between gap-3">
          <MonoLabel dash>Speed read</MonoLabel>
          <MonoLabel>{{ wpm }} wpm · {{ index + 1 }}/{{ words.length }}</MonoLabel>
        </header>
        <HairlineRule class="mt-3" />

        <!-- The word, fixed in place. The ORP letter carries the screen's one
             accent; the 1fr|auto|1fr grid pins it to a constant x so the eye
             never travels. The whole area is one big play/pause target. -->
        <button
          type="button"
          class="rsvp-stage flex flex-1 select-none flex-col items-center justify-center outline-none"
          :aria-label="playing ? 'Pause' : 'Play'"
          @click="toggle"
        >
          <div class="rsvp-word w-full font-serif text-4xl text-ink sm:text-5xl" aria-live="off">
            <span class="pre">{{ pre }}</span
            ><span class="orp text-accent-ink">{{ orp }}</span
            ><span class="post">{{ post }}</span>
          </div>
          <MonoLabel v-if="!playing" class="mt-8">
            {{ done ? 'Done' : 'Tap the word or press space' }}
          </MonoLabel>
          <div v-else class="mt-8" style="height: 10px" aria-hidden="true" />
        </button>

        <!-- Progress: a hairline that fills as the stream advances. -->
        <div class="h-[2px] w-full bg-rule" aria-hidden="true">
          <div class="h-full bg-mute" :style="{ width: progressPercent + '%' }" />
        </div>

        <!-- flex-wrap: on narrow phones the two groups break onto separate
             lines instead of pushing past the screen edge. -->
        <div class="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div class="flex flex-wrap gap-1.5 sm:gap-2">
            <ActionLabel aria-label="Slower" @click="adjustWpm(-RSVP.WPM_STEP)">Slower</ActionLabel>
            <ActionLabel aria-label="Faster" @click="adjustWpm(RSVP.WPM_STEP)">Faster</ActionLabel>
          </div>
          <div class="flex flex-wrap gap-1.5 sm:gap-2">
            <ActionLabel v-if="done" aria-label="Restart" @click="restart">Restart</ActionLabel>
            <ActionLabel v-else :aria-label="playing ? 'Pause' : 'Play'" @click="toggle">
              {{ playing ? 'Pause' : 'Play' }}
            </ActionLabel>
            <ActionLabel aria-label="Close" @click="emit('close')">Close</ActionLabel>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { RSVP, orpIndex, wordDelayMs } from '~/utils/rsvp'

const props = defineProps<{ words: string[] }>()
const emit = defineEmits<{ close: [] }>()

const WPM_KEY = 'reader:rsvpWpm'

const index = ref(0)
const playing = ref(false)
const wpm = ref<number>(RSVP.WPM_DEFAULT)

/** True once the stream has run to the last word (until restart/rewind). */
const done = ref(false)

const word = computed(() => props.words[index.value] ?? '')
const orpAt = computed(() => orpIndex(word.value))
const pre = computed(() => word.value.slice(0, orpAt.value))
const orp = computed(() => word.value.slice(orpAt.value, orpAt.value + 1))
const post = computed(() => word.value.slice(orpAt.value + 1))
const progressPercent = computed(() =>
  props.words.length ? ((index.value + 1) / props.words.length) * 100 : 0,
)

let timer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (timer) { clearTimeout(timer); timer = null }
}

function schedule() {
  clearTimer()
  timer = setTimeout(() => {
    if (index.value < props.words.length - 1) {
      index.value++
      schedule()
    } else {
      playing.value = false
      done.value = true
    }
  }, wordDelayMs(word.value, wpm.value))
}

function play() {
  if (!props.words.length) return
  if (done.value) { index.value = 0; done.value = false }
  playing.value = true
  schedule()
}

function pause() {
  playing.value = false
  clearTimer()
}

function toggle() {
  playing.value ? pause() : play()
}

function restart() {
  index.value = 0
  done.value = false
  play()
}

function skip(delta: number) {
  index.value = Math.min(Math.max(index.value + delta, 0), props.words.length - 1)
  if (done.value && delta < 0) done.value = false
  // Re-time the (possibly new) current word so a skip doesn't inherit the
  // old word's remaining dwell.
  if (playing.value) schedule()
}

function adjustWpm(delta: number) {
  wpm.value = Math.min(Math.max(wpm.value + delta, RSVP.WPM_MIN), RSVP.WPM_MAX)
}

// The new pace applies from the current word, not the next one.
watch(wpm, (v) => {
  if (playing.value) schedule()
  try { localStorage.setItem(WPM_KEY, String(v)) } catch { /* private mode */ }
})

function onKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return
  if (e.key === ' ') { e.preventDefault(); toggle() }
  else if (e.key === 'Escape') { e.preventDefault(); emit('close') }
  else if (e.key === 'ArrowLeft') { e.preventDefault(); skip(-RSVP.SKIP_WORDS) }
  else if (e.key === 'ArrowRight') { e.preventDefault(); skip(RSVP.SKIP_WORDS) }
  else if (e.key === 'ArrowUp') { e.preventDefault(); adjustWpm(RSVP.WPM_STEP) }
  else if (e.key === 'ArrowDown') { e.preventDefault(); adjustWpm(-RSVP.WPM_STEP) }
}

onMounted(() => {
  try {
    const stored = Number(localStorage.getItem(WPM_KEY))
    if (stored >= RSVP.WPM_MIN && stored <= RSVP.WPM_MAX) wpm.value = stored
  } catch { /* private mode */ }
  window.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  clearTimer()
})
</script>

<style scoped>
/* Pin the ORP letter to a fixed x: equal flexible gutters either side of the
   accent glyph mean the word re-centers around that letter every beat. */
.rsvp-word {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: baseline;
  white-space: pre;
}
.rsvp-word .pre {
  text-align: right;
}
.rsvp-word .post {
  text-align: left;
}
/* A quiet tick above and below the accent letter marks the fixation point
   even between words. */
.rsvp-word .orp {
  position: relative;
}
.rsvp-word .orp::before,
.rsvp-word .orp::after {
  content: '';
  position: absolute;
  left: 50%;
  width: 1px;
  height: 0.35em;
  background: var(--border-rule);
}
.rsvp-word .orp::before { top: -0.65em; }
.rsvp-word .orp::after { bottom: -0.55em; }
</style>
