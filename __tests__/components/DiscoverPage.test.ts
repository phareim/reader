import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, computed, onMounted } from 'vue'
import DiscoverPage from '~/pages/discover.vue'

// Nuxt auto-imported primitives aren't injected under Jest — expose on globalThis.
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).onMounted = onMounted

const FRESH = new Date().toISOString()
const STALE = '2020-01-01T00:00:00Z'

const ROWS = [
  {
    id: 1,
    title: 'A Friend',
    siteUrl: 'https://friend.example/',
    siteHost: 'friend.example',
    feedUrl: 'https://friend.example/feed.xml',
    description: 'Notes on calm computing.',
    newestArticleAt: FRESH,
    viaCount: 3,
    viaTitles: ['Alpha Blog', 'Beta Blog', 'Gamma Blog', 'Delta Blog'],
  },
  {
    id: 2,
    title: 'Old Timer',
    siteUrl: 'https://old.example/',
    siteHost: 'old.example',
    feedUrl: 'https://old.example/rss',
    description: null,
    newestArticleAt: STALE,
    viaCount: 1,
    viaTitles: ['Alpha Blog'],
  },
]

let fetchMock: jest.Mock
let showSuccess: jest.Mock
let showError: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn().mockImplementation((url: string) => {
    if (url === '/api/discover') return Promise.resolve({ candidates: [...ROWS] })
    if (url.endsWith('/subscribe')) return Promise.resolve({ feed: { title: 'A Friend' }, articlesAdded: 12 })
    return Promise.resolve({ ok: true })
  })
  ;(globalThis as any).$fetch = fetchMock
  showSuccess = jest.fn()
  showError = jest.fn()
  ;(globalThis as any).useToast = () => ({ showSuccess, showError })
})

afterEach(() => jest.clearAllMocks())

const stubs = {
  MonoLabel: defineComponent({
    props: { dash: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  HairlineRule: true,
  ActionLabel: defineComponent({
    props: { accent: Boolean, disabled: Boolean },
    emits: ['click'],
    setup: (props: any, { slots, emit }) => () =>
      h('button', { class: 'action-label', disabled: props.disabled, onClick: () => emit('click') }, slots.default?.()),
  }),
}

const mountPage = async () => {
  const w = mount(DiscoverPage, { global: { stubs } })
  await flushPromises()
  return w
}

describe('pages/discover.vue', () => {
  it('lists candidates in server order with the via line', async () => {
    const w = await mountPage()

    expect(fetchMock).toHaveBeenCalledWith('/api/discover')
    const items = w.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('A Friend')
    expect(items[0].text()).toContain('via 3 sources — Alpha Blog, Beta Blog, Gamma Blog…')
    expect(items[1].text()).toContain('via 1 source — Alpha Blog')
    expect(w.text()).toContain('2 recommended')
    expect(w.find('a[href="https://friend.example/"]').exists()).toBe(true)
  })

  it('shows the quiet note only on stale candidates', async () => {
    const w = await mountPage()
    const items = w.findAll('li')
    expect(items[0].text()).not.toContain('quiet')
    expect(items[1].text()).toContain('quiet — last article')
  })

  it('Add subscribes, toasts, and flips the row to Added', async () => {
    const w = await mountPage()

    await w.findAll('li')[0].find('.action-label').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/discover/1/subscribe', { method: 'POST' })
    expect(showSuccess).toHaveBeenCalledWith('Added A Friend — 12 articles')
    const row = w.findAll('li')[0]
    expect(row.text()).toContain('Added')
    expect(row.find('.action-label').exists()).toBe(false)
    expect(row.find('.disc-dismiss').exists()).toBe(false)
  })

  it('failed Add keeps the row actionable and toasts the error', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/discover') return Promise.resolve({ candidates: [...ROWS] })
      return Promise.reject(new Error('422'))
    })
    const w = await mountPage()

    await w.findAll('li')[0].find('.action-label').trigger('click')
    await flushPromises()

    expect(showError).toHaveBeenCalled()
    expect(w.findAll('li')[0].find('.action-label').exists()).toBe(true)
  })

  it('Dismiss posts and removes the row without a toast', async () => {
    const w = await mountPage()

    await w.findAll('li')[0].find('.disc-dismiss').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/discover/1/dismiss', { method: 'POST' })
    expect(w.findAll('li')).toHaveLength(1)
    expect(w.text()).not.toContain('A Friend')
    expect(showSuccess).not.toHaveBeenCalled()
  })

  it('failed Dismiss restores the row and toasts', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/discover') return Promise.resolve({ candidates: [...ROWS] })
      return Promise.reject(new Error('boom'))
    })
    const w = await mountPage()

    await w.findAll('li')[0].find('.disc-dismiss').trigger('click')
    await flushPromises()

    expect(w.findAll('li')).toHaveLength(2)
    expect(w.findAll('li')[0].text()).toContain('A Friend')
    expect(showError).toHaveBeenCalled()
  })

  it('empty state offers Look now, which crawls then refetches', async () => {
    fetchMock.mockImplementation((url: string) => {
      if (url === '/api/discover') return Promise.resolve({ candidates: [] })
      return Promise.resolve({ sitesCrawled: 3 })
    })
    const w = await mountPage()
    expect(w.text()).toContain('Nothing new yet')

    await w.find('.action-label').trigger('click')
    await flushPromises()

    expect(fetchMock).toHaveBeenCalledWith('/api/discover/refresh', { method: 'POST' })
    const listCalls = fetchMock.mock.calls.filter(([url]) => url === '/api/discover')
    expect(listCalls).toHaveLength(2)
  })
})
