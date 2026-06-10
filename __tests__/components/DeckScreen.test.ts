import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, onMounted, onUnmounted } from 'vue'
import DeckScreen from '~/components/DeckScreen.vue'

// DeckScreen.vue uses Nuxt auto-imported Vue primitives (ref, onMounted, etc.)
// which are not injected into the component scope under Jest. Provide them on
// globalThis so the compiled component's setup() can resolve them.
;(globalThis as any).ref = ref
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// ---------------------------------------------------------------------------
// Composable stubs — provided via globalThis because Nuxt auto-imports
// don't resolve under Jest.
// ---------------------------------------------------------------------------
let fetchArticles: jest.Mock
let fetchSavedArticleIds: jest.Mock
let unreadArticles: ReturnType<typeof ref<any[]>>

beforeEach(() => {
  fetchArticles = jest.fn().mockResolvedValue(undefined)
  fetchSavedArticleIds = jest.fn().mockResolvedValue(undefined)
  unreadArticles = ref([] as any[])

  ;(globalThis as any).useArticles = () => ({ fetchArticles, unreadArticles })
  ;(globalThis as any).useSavedArticles = () => ({ fetchSavedArticleIds })
  ;(globalThis as any).useFeeds = () => ({ syncAll: jest.fn() })
  ;(globalThis as any).useToast = () => ({ showSuccess: jest.fn(), showError: jest.fn() })
})

afterEach(() => {
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Child-component stubs
// ---------------------------------------------------------------------------
const stubs = {
  CardStack: defineComponent({
    props: ['articles', 'syncing'],
    setup: (p: any) => () =>
      h('div', { 'data-testid': 'card-stack', 'data-count': p.articles?.length }),
  }),
  HelpOverlay: true,
  MonoLabel: defineComponent({
    props: { dash: Boolean, accent: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  HairlineRule: true,
  ClientOnly: defineComponent({
    setup: (_, { slots }) => () => h('div', slots.default?.()),
  }),
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DeckScreen', () => {
  it('no tag prop — fetchArticles called with (undefined, undefined, undefined) and header shows "The Reader"', async () => {
    const w = mount(DeckScreen, { global: { stubs } })
    await flushPromises()

    expect(fetchArticles).toHaveBeenCalledWith(undefined, undefined, undefined)
    expect(w.text()).toContain('The Reader')
  })

  it('tag="tech" — fetchArticles called with (undefined, undefined, "tech") and header shows "tech"', async () => {
    const w = mount(DeckScreen, { props: { tag: 'tech' }, global: { stubs } })
    await flushPromises()

    expect(fetchArticles).toHaveBeenCalledWith(undefined, undefined, 'tech')
    expect(w.text()).toContain('tech')
  })

  it('fetchArticles rejects with { statusCode: 404 } — emits notFound, stays mounted, loaded stays false', async () => {
    fetchArticles.mockRejectedValueOnce({ statusCode: 404 })

    const w = mount(DeckScreen, { global: { stubs } })
    await flushPromises()

    // notFound should have been emitted exactly once
    expect(w.emitted().notFound).toBeTruthy()
    expect(w.emitted().notFound).toHaveLength(1)

    // The component must still be mounted (no thrown error)
    expect(w.exists()).toBe(true)

    // loaded stays false → CardStack is NOT rendered (no empty-deck flash)
    expect(w.find('[data-testid="card-stack"]').exists()).toBe(false)
  })

  it('snapshot pattern — articles passed to CardStack equal unreadArticles at fetch time', async () => {
    const articles = [
      { id: 1, title: 'One', feedTitle: 'Feed', isRead: false },
      { id: 2, title: 'Two', feedTitle: 'Feed', isRead: false },
      { id: 3, title: 'Three', feedTitle: 'Feed', isRead: false },
    ] as any[]

    // Populate the ref before the component mounts so refillDeck() copies them.
    unreadArticles.value = articles

    const w = mount(DeckScreen, { global: { stubs } })
    await flushPromises()

    const stackEl = w.find('[data-testid="card-stack"]')
    expect(stackEl.exists()).toBe(true)
    expect(Number(stackEl.attributes('data-count'))).toBe(articles.length)
  })
})
