import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, computed, onMounted } from 'vue'
import FoundPage from '~/pages/found.vue'

// Nuxt auto-imported primitives aren't injected under Jest — expose on globalThis.
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).onMounted = onMounted

let feeds: ReturnType<typeof ref<any[]>>
let fetchFeeds: jest.Mock
let loading: ReturnType<typeof ref<boolean>>

beforeEach(() => {
  feeds = ref([] as any[])
  fetchFeeds = jest.fn().mockResolvedValue(undefined)
  loading = ref(false)
  ;(globalThis as any).useFeeds = () => ({ feeds, fetchFeeds, loading })
})

afterEach(() => jest.clearAllMocks())

const stubs = {
  DeckScreen: defineComponent({
    props: ['feedId', 'title'],
    setup: (p: any) => () =>
      h('div', { 'data-testid': 'deck', 'data-feed': p.feedId, 'data-title': p.title }),
  }),
  MonoLabel: defineComponent({
    props: { dash: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  ActionLabel: defineComponent({ setup: (_, { slots }) => () => h('button', slots.default?.()) }),
  HairlineRule: true,
  NuxtLink: defineComponent({
    props: ['to'],
    setup: (_, { slots }) => () => h('a', slots.default?.()),
  }),
}

describe('pages/found.vue', () => {
  it('no Found feed yet → fetches feeds and shows the empty state', async () => {
    const w = mount(FoundPage, { global: { stubs } })
    await flushPromises()

    expect(fetchFeeds).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="deck"]').exists()).toBe(false)
    expect(w.text()).toContain('Nothing found yet')
  })

  it('Found feed present → mounts the deck scoped to it with title "Found"', async () => {
    feeds.value = [
      { id: 7, kind: 'rss', title: 'Some blog' },
      { id: 42, kind: 'found', title: 'Found' },
    ]
    const w = mount(FoundPage, { global: { stubs } })
    await flushPromises()

    const deck = w.find('[data-testid="deck"]')
    expect(deck.exists()).toBe(true)
    expect(deck.attributes('data-feed')).toBe('42')
    expect(deck.attributes('data-title')).toBe('Found')
    // feeds already loaded → no refetch
    expect(fetchFeeds).not.toHaveBeenCalled()
  })
})
