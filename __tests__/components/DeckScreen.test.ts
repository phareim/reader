import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, computed, watch, readonly, onMounted, onUnmounted } from 'vue'
import DeckScreen from '~/components/DeckScreen.vue'

// DeckScreen.vue uses Nuxt auto-imported Vue primitives (ref, computed, etc.)
// which are not injected into the component scope under Jest. Provide them on
// globalThis so the compiled component's setup() can resolve them.
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).readonly = readonly
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// ---------------------------------------------------------------------------
// Composable stubs — provided via globalThis because Nuxt auto-imports
// don't resolve under Jest.
// ---------------------------------------------------------------------------
let fetchArticles: jest.Mock
let loadMoreArticles: jest.Mock
let fetchSavedArticleIds: jest.Mock
let unreadArticles: ReturnType<typeof ref<any[]>>
let articles: ReturnType<typeof ref<any[]>>
let savedArticleIds: ReturnType<typeof ref<Set<number>>>
let total: ReturnType<typeof ref<number>>
let hasMore: ReturnType<typeof ref<boolean>>
let loadingMore: ReturnType<typeof ref<boolean>>
let viewMode: ReturnType<typeof ref<'deck' | 'grid'>>
let setViewMode: jest.Mock
let authUser: ReturnType<typeof ref<boolean>>
let authChecked: ReturnType<typeof ref<boolean>>
let navigateToMock: jest.Mock
let syncAllMock: jest.Mock
let refreshFeedMock: jest.Mock
let feedsList: ReturnType<typeof ref<any[]>>

beforeEach(() => {
  fetchArticles = jest.fn().mockResolvedValue(undefined)
  loadMoreArticles = jest.fn().mockResolvedValue(undefined)
  fetchSavedArticleIds = jest.fn().mockResolvedValue(undefined)
  unreadArticles = ref([] as any[])
  articles = ref([] as any[])
  savedArticleIds = ref(new Set<number>())
  total = ref(0)
  hasMore = ref(false)
  loadingMore = ref(false)
  viewMode = ref<'deck' | 'grid'>('deck')
  setViewMode = jest.fn((mode: 'deck' | 'grid') => { viewMode.value = mode })

  ;(globalThis as any).useArticles = () => ({
    fetchArticles, loadMoreArticles, unreadArticles, articles, total, hasMore, loadingMore,
  })
  ;(globalThis as any).useSavedArticles = () => ({ fetchSavedArticleIds, savedArticleIds })
  syncAllMock = jest.fn().mockResolvedValue(undefined)
  refreshFeedMock = jest.fn().mockResolvedValue({ success: true, newArticles: 0 })
  feedsList = ref([] as any[])
  ;(globalThis as any).useFeeds = () => ({
    syncAll: syncAllMock,
    refreshFeed: refreshFeedMock,
    feeds: feedsList,
    fetchFeeds: jest.fn().mockResolvedValue(undefined),
  })
  ;(globalThis as any).useToast = () => ({ showSuccess: jest.fn(), showError: jest.fn() })
  ;(globalThis as any).useViewMode = () => ({ viewMode, setViewMode })
  authUser = ref(true)
  authChecked = ref(true)
  navigateToMock = jest.fn()
  ;(globalThis as any).useAuth = () => ({
    personal: ref(true),
    loggedIn: computed(() => authUser.value),
    checked: authChecked,
  })
  ;(globalThis as any).navigateTo = navigateToMock
})

// Every test's component registers a window keydown listener — unmount them
// all so a stale listener from one test can't act on another's key events.
const wrappers: Array<{ unmount: () => void }> = []
function mountScreen(options: any = {}) {
  const w = mount(DeckScreen, { global: { stubs }, ...options })
  wrappers.push(w)
  return w
}

afterEach(() => {
  while (wrappers.length) wrappers.pop()!.unmount()
  jest.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Child-component stubs
// ---------------------------------------------------------------------------
const stackCommit = jest.fn()
const stackUndo = jest.fn()
const gridUndo = jest.fn()

const stubs = {
  CardStack: defineComponent({
    props: ['articles', 'syncing'],
    setup: (p: any, { expose }: any) => {
      expose({ commit: stackCommit, undo: stackUndo, openTop: jest.fn() })
      return () =>
        h('div', { 'data-testid': 'card-stack', 'data-count': p.articles?.length })
    },
  }),
  ArticleGrid: defineComponent({
    props: ['articles', 'hasMore', 'loadingMore', 'syncing'],
    setup: (p: any, { expose }: any) => {
      expose({ undo: gridUndo })
      return () =>
        h('div', { 'data-testid': 'article-grid', 'data-count': p.articles?.length })
    },
  }),
  HelpOverlay: true,
  ActionLabel: defineComponent({
    props: { accent: Boolean, disabled: Boolean },
    emits: ['click'],
    setup: (_, { slots, emit }) => () =>
      h('button', { 'data-testid': 'action-label', onClick: () => emit('click') }, slots.default?.()),
  }),
  MonoLabel: defineComponent({
    props: { dash: Boolean, accent: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  HairlineRule: true,
  ClientOnly: defineComponent({
    setup: (_, { slots }) => () => h('div', slots.default?.()),
  }),
}

const key = (k: string, opts: KeyboardEventInit = {}) =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, ...opts }))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('DeckScreen', () => {
  it('no tag prop — fetchArticles called with (undefined, undefined, undefined) and header shows "The Reader"', async () => {
    const w = mountScreen()
    await flushPromises()

    expect(fetchArticles).toHaveBeenCalledWith(undefined, undefined, undefined)
    expect(fetchSavedArticleIds).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('The Reader')
  })

  it('signed out (checked, no user) — shows the sign-in doorstep instead of the deck', async () => {
    authUser.value = false
    const w = mountScreen()
    await flushPromises()

    const btn = w.find('[data-testid="action-label"]')
    expect(btn.exists()).toBe(true)
    expect(btn.text()).toContain('Sign in')
    expect(w.find('[data-testid="card-stack"]').exists()).toBe(false)
    expect(w.text()).not.toContain('unread')

    await btn.trigger('click')
    expect(navigateToMock).toHaveBeenCalledWith('/login')
  })

  it('session still checking — never flashes the sign-in doorstep', async () => {
    authUser.value = false
    authChecked.value = false
    const w = mountScreen()
    await flushPromises()

    expect(w.find('[data-testid="action-label"]').exists()).toBe(false)
  })

  it('tag="tech" — fetchArticles called with (undefined, undefined, "tech") and header shows "tech"', async () => {
    const w = mountScreen({ props: { tag: 'tech' } })
    await flushPromises()

    expect(fetchArticles).toHaveBeenCalledWith(undefined, undefined, 'tech')
    expect(fetchSavedArticleIds).toHaveBeenCalledTimes(1)
    expect(w.text()).toContain('tech')
  })

  it('fetchArticles rejects with { statusCode: 404 } — emits notFound, stays mounted, loaded stays false', async () => {
    fetchArticles.mockRejectedValueOnce({ statusCode: 404 })

    const w = mountScreen()
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
    const list = [
      { id: 1, title: 'One', feedTitle: 'Feed', isRead: false },
      { id: 2, title: 'Two', feedTitle: 'Feed', isRead: false },
      { id: 3, title: 'Three', feedTitle: 'Feed', isRead: false },
    ] as any[]

    // Populate the ref before the component mounts so refillDeck() copies them.
    unreadArticles.value = list

    const w = mountScreen()
    await flushPromises()

    const stackEl = w.find('[data-testid="card-stack"]')
    expect(stackEl.exists()).toBe(true)
    expect(Number(stackEl.attributes('data-count'))).toBe(list.length)
  })

  it('grid mode — mounts ArticleGrid with the live unread-and-unsaved list, not CardStack', async () => {
    viewMode.value = 'grid'
    unreadArticles.value = [
      { id: 1, isRead: false }, { id: 2, isRead: false }, { id: 3, isRead: false },
    ] as any[]
    savedArticleIds.value = new Set([2]) // saved → filtered out of the grid

    const w = mountScreen()
    await flushPromises()

    expect(w.find('[data-testid="card-stack"]').exists()).toBe(false)
    const grid = w.find('[data-testid="article-grid"]')
    expect(grid.exists()).toBe(true)
    expect(Number(grid.attributes('data-count'))).toBe(2)
  })

  it('toggle buttons call setViewMode and swap the mounted view', async () => {
    unreadArticles.value = [{ id: 1, isRead: false }] as any[]
    const w = mountScreen()
    await flushPromises()

    expect(w.find('[data-testid="card-stack"]').exists()).toBe(true)

    const buttons = w.findAll('button.view-toggle')
    expect(buttons).toHaveLength(2)
    await buttons[1].trigger('click') // Grid
    await flushPromises()

    expect(setViewMode).toHaveBeenCalledWith('grid')
    expect(w.find('[data-testid="article-grid"]').exists()).toBe(true)
    expect(w.find('[data-testid="card-stack"]').exists()).toBe(false)
  })

  it('grid keyboard — arrows do not commit, u forwards to the grid undo', async () => {
    viewMode.value = 'grid'
    unreadArticles.value = [{ id: 1, isRead: false }] as any[]
    mountScreen({ attachTo: document.body })
    await flushPromises()

    key('ArrowLeft')
    key('ArrowRight')
    key('Enter')
    expect(stackCommit).not.toHaveBeenCalled()

    key('u')
    expect(gridUndo).toHaveBeenCalledTimes(1)
  })

  it('feed-scoped deck — shift+R syncs only that feed via refreshFeed', async () => {
    feedsList.value = [{ id: 7, title: 'Blog', kind: 'rss' }] as any[]
    mountScreen({ props: { feedId: 7, title: 'Blog' }, attachTo: document.body })
    await flushPromises()

    key('R', { shiftKey: true })
    await flushPromises()

    expect(refreshFeedMock).toHaveBeenCalledWith(7)
    expect(syncAllMock).not.toHaveBeenCalled()
  })

  it('push-only Found feed — shift+R falls back to the full sync', async () => {
    feedsList.value = [{ id: 9, title: 'Found', kind: 'found' }] as any[]
    mountScreen({ props: { feedId: 9, title: 'Found' }, attachTo: document.body })
    await flushPromises()

    key('R', { shiftKey: true })
    await flushPromises()

    expect(refreshFeedMock).not.toHaveBeenCalled()
    expect(syncAllMock).toHaveBeenCalledTimes(1)
  })

  it('returning to deck mode re-snapshots the deck from the live unread list', async () => {
    viewMode.value = 'grid'
    unreadArticles.value = [
      { id: 1, isRead: false }, { id: 2, isRead: false },
    ] as any[]

    const w = mountScreen()
    await flushPromises()

    // Grid session consumed article 1.
    unreadArticles.value = [{ id: 2, isRead: false }] as any[]

    viewMode.value = 'deck'
    await flushPromises()

    const stackEl = w.find('[data-testid="card-stack"]')
    expect(stackEl.exists()).toBe(true)
    expect(Number(stackEl.attributes('data-count'))).toBe(1)
  })
})
