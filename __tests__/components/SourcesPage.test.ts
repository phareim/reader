import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, computed, reactive, onMounted } from 'vue'
import SourcesPage from '~/pages/sources.vue'

// Nuxt auto-imported primitives aren't injected under Jest — expose on globalThis.
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).reactive = reactive
;(globalThis as any).onMounted = onMounted
;(globalThis as any).TEXT_SIZE = { MIN: 80, MAX: 130, STEP: 10, DEFAULT: 100 }
;(globalThis as any).navigateTo = jest.fn()
;(globalThis as any).useRoute = () => ({ query: {} })

const makeFeeds = () => [
  { id: 1, title: 'Alpha Blog', unreadCount: 4, kind: 'rss', halfLifeHours: null, tags: [] },
  { id: 2, title: 'Beta Blog', unreadCount: 0, kind: 'rss', halfLifeHours: null, tags: [] },
]

let feeds: ReturnType<typeof ref<any[]>>
let fetchMock: jest.Mock
let showSuccess: jest.Mock
let showError: jest.Mock
let markAllAsRead: jest.Mock
let deleteFeed: jest.Mock

beforeEach(() => {
  feeds = ref(makeFeeds())
  fetchMock = jest.fn().mockImplementation((url: string) => {
    if (url === '/api/sources/links') return Promise.resolve({ sources: [] })
    return Promise.resolve({ ok: true })
  })
  ;(globalThis as any).$fetch = fetchMock
  showSuccess = jest.fn()
  showError = jest.fn()
  markAllAsRead = jest.fn().mockResolvedValue(undefined)
  deleteFeed = jest.fn().mockImplementation(async (id: number) => {
    feeds.value = feeds.value!.filter((f: any) => f.id !== id)
    return { deletedArticles: 2 }
  })
  ;(globalThis as any).useToast = () => ({ showSuccess, showError })
  ;(globalThis as any).useFeeds = () => ({
    feeds,
    feedsByTag: computed(() => ({ __inbox__: feeds.value })),
    allTags: computed(() => []),
    fetchFeeds: jest.fn().mockResolvedValue(undefined),
    addFeed: jest.fn(),
    smartAddFeed: jest.fn(),
    deleteFeed,
    syncAll: jest.fn(),
    refreshFeed: jest.fn().mockResolvedValue({ newArticles: 3 }),
    updateFeedTags: jest.fn(),
    updateFeedHalfLife: jest.fn(),
  })
  ;(globalThis as any).useArticles = () => ({ markAllAsRead, fetchArticles: jest.fn() })
  ;(globalThis as any).useAuth = () => ({ user: ref(null), signOut: jest.fn() })
  ;(globalThis as any).useTextSize = () => ({
    textSize: ref(100),
    increase: jest.fn(),
    decrease: jest.fn(),
  })
})

afterEach(() => jest.clearAllMocks())

const stubs = {
  MonoLabel: defineComponent({
    props: { dash: Boolean, accent: Boolean },
    setup: (_, { slots }) => () => h('span', { class: 'mono-label' }, slots.default?.()),
  }),
  HairlineRule: true,
  FeedFavicon: true,
  ClientOnly: defineComponent({ setup: (_, { slots }) => () => slots.default?.() }),
  ActionLabel: defineComponent({
    props: { accent: Boolean, disabled: Boolean },
    emits: ['click'],
    setup: (props: any, { slots, emit }) => () =>
      h('button', { class: 'action-label', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.()),
  }),
  NuxtLink: defineComponent({
    props: { to: { type: String, required: true } },
    setup: (props: any, { slots }) => () => h('a', { href: props.to }, slots.default?.()),
  }),
  TagEditorOverlay: true,
  FeedPickerOverlay: true,
  SaveArticleOverlay: true,
}

const mountPage = async () => {
  const w = mount(SourcesPage, { global: { stubs } })
  await flushPromises()
  return w
}

const rows = (w: any) => w.findAll('li.feed-row')
const toggleOf = (row: any) => row.find('.feed-more')

describe('pages/sources.vue', () => {
  it('renders one calm line per feed: title link, count only when unread', async () => {
    const w = await mountPage()

    const items = rows(w)
    expect(items).toHaveLength(2)
    expect(items[0].find('a[href="/feed/1"]').text()).toContain('Alpha Blog')
    expect(items[0].find('.mono-label').text()).toBe('4')
    // Beta is caught up — no zero shown.
    expect(items[1].find('.mono-label').exists()).toBe(false)
  })

  it('hides the verbs until the ··· toggle opens them, one row at a time', async () => {
    const w = await mountPage()

    expect(w.find('.feed-verbs').exists()).toBe(false)

    await toggleOf(rows(w)[0]).trigger('click')
    expect(rows(w)[0].find('.feed-verbs').exists()).toBe(true)
    expect(rows(w)[0].find('.feed-verbs').text()).toContain('Mark read')
    expect(toggleOf(rows(w)[0]).attributes('aria-expanded')).toBe('true')

    // Opening the second row closes the first.
    await toggleOf(rows(w)[1]).trigger('click')
    expect(rows(w)[0].find('.feed-verbs').exists()).toBe(false)
    expect(rows(w)[1].find('.feed-verbs').exists()).toBe(true)

    // Tapping the open toggle closes it again.
    await toggleOf(rows(w)[1]).trigger('click')
    expect(w.find('.feed-verbs').exists()).toBe(false)
  })

  it('Mark read from the open row calls through and toasts', async () => {
    const w = await mountPage()

    await toggleOf(rows(w)[0]).trigger('click')
    const markBtn = rows(w)[0].findAll('.feed-verbs button').find((b: any) => b.text() === 'Mark read')!
    await markBtn.trigger('click')
    await flushPromises()

    expect(markAllAsRead).toHaveBeenCalledWith(1)
    expect(showSuccess).toHaveBeenCalledWith('Marked read')
  })

  it('Delete removes the row and clears the open state', async () => {
    window.confirm = jest.fn().mockReturnValue(true)
    const w = await mountPage()

    await toggleOf(rows(w)[0]).trigger('click')
    const deleteBtn = rows(w)[0].findAll('.feed-verbs button').find((b: any) => b.text() === 'Delete')!
    await deleteBtn.trigger('click')
    await flushPromises()

    expect(deleteFeed).toHaveBeenCalledWith(1)
    expect(rows(w)).toHaveLength(1)
    expect(w.find('.feed-verbs').exists()).toBe(false)
  })
})
