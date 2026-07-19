import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, computed, onMounted } from 'vue'
import GoodReadsPage from '~/pages/good-reads.vue'

// Nuxt auto-imported primitives aren't injected under Jest — expose on globalThis.
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).onMounted = onMounted

const ROWS = [
  {
    id: 10,
    feedId: 1,
    feedTitle: 'Blog',
    title: 'On calm software',
    url: 'https://example.com/calm',
    summary: 'Software should wait quietly for its person.',
    goodReadAt: '2026-07-03T00:00:00Z',
  },
  {
    id: 11,
    feedId: 2,
    feedTitle: 'Essays',
    title: 'Deep work',
    url: null,
    summary: null,
    goodReadAt: '2026-07-01T00:00:00Z',
  },
]

let fetchMock: jest.Mock
let unmarkGoodRead: jest.Mock
let showSuccess: jest.Mock
let showError: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ articles: [...ROWS] })
  ;(globalThis as any).$fetch = fetchMock
  unmarkGoodRead = jest.fn().mockResolvedValue(undefined)
  showSuccess = jest.fn()
  showError = jest.fn()
  ;(globalThis as any).useGoodReads = () => ({ unmarkGoodRead })
  ;(globalThis as any).useToast = () => ({ showSuccess, showError })
})

afterEach(() => jest.clearAllMocks())

const stubs = {
  MonoLabel: defineComponent({
    props: { dash: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  HairlineRule: true,
  NuxtLink: defineComponent({
    props: ['to'],
    setup: (p: any, { slots }) => () => h('a', { href: p.to }, slots.default?.()),
  }),
}

const mountPage = async () => {
  const w = mount(GoodReadsPage, { global: { stubs } })
  await flushPromises()
  return w
}

describe('pages/good-reads.vue', () => {
  it('lists starred articles with feed, title, and article link', async () => {
    const w = await mountPage()

    expect(fetchMock).toHaveBeenCalledWith('/api/good-reads')
    const items = w.findAll('li')
    expect(items).toHaveLength(2)
    expect(w.text()).toContain('On calm software')
    expect(w.text()).toContain('2 starred')
    expect(items[0].text()).toContain('Blog')
    expect(w.find('a[href="/article/10"]').exists()).toBe(true)
    expect(w.find('a[href="/article/11"]').exists()).toBe(true)
  })

  it('removes a mark: API call, row gone, toast', async () => {
    const w = await mountPage()

    await w.findAll('.gr-remove')[0].trigger('click')
    await flushPromises()

    expect(unmarkGoodRead).toHaveBeenCalledWith(10)
    expect(w.findAll('li')).toHaveLength(1)
    expect(showSuccess).toHaveBeenCalled()
  })

  it('failed remove keeps the row and toasts the error', async () => {
    unmarkGoodRead.mockRejectedValueOnce(new Error('nope'))
    const w = await mountPage()

    await w.findAll('.gr-remove')[0].trigger('click')
    await flushPromises()

    expect(w.findAll('li')).toHaveLength(2)
    expect(showError).toHaveBeenCalled()
  })

  it('shows the empty state when nothing is starred', async () => {
    fetchMock.mockResolvedValueOnce({ articles: [] })
    const w = await mountPage()
    expect(w.text()).toContain('Nothing starred yet')
  })
})
