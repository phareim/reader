import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, ref, computed, onMounted } from 'vue'
import HighlightsPage from '~/pages/highlights.vue'

// Nuxt auto-imported primitives aren't injected under Jest — expose on globalThis.
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).onMounted = onMounted

const ROWS = [
  {
    id: 1,
    articleId: 10,
    articleTitle: 'On calm software',
    articleUrl: 'https://example.com/calm',
    feedTitle: 'Blog',
    sflIdeaId: 'idea-1',
    quote: 'Software should wait quietly.',
    note: 'The core thesis #calm #design',
    createdAt: '2026-07-01T00:00:00Z',
  },
  {
    id: 2,
    articleId: 11,
    articleTitle: 'Deep work',
    articleUrl: 'https://example.com/deep',
    feedTitle: 'Blog',
    sflIdeaId: null,
    quote: 'Attention is finite.',
    note: null,
    createdAt: '2026-07-02T00:00:00Z',
  },
  {
    id: 3,
    articleId: 12,
    articleTitle: 'Type systems',
    articleUrl: null,
    feedTitle: 'Blog',
    sflIdeaId: null,
    quote: 'Types are proofs.',
    note: 'save for the talk #design',
    createdAt: '2026-07-03T00:00:00Z',
  },
]

let fetchMock: jest.Mock
let deleteHighlight: jest.Mock
let showSuccess: jest.Mock
let showError: jest.Mock

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ highlights: [...ROWS] })
  ;(globalThis as any).$fetch = fetchMock
  deleteHighlight = jest.fn().mockResolvedValue(undefined)
  showSuccess = jest.fn()
  showError = jest.fn()
  ;(globalThis as any).useHighlights = () => ({ deleteHighlight })
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
  const w = mount(HighlightsPage, { global: { stubs } })
  await flushPromises()
  return w
}

describe('pages/highlights.vue', () => {
  it('lists all marks with quote, note, and article link', async () => {
    const w = await mountPage()

    expect(fetchMock).toHaveBeenCalledWith('/api/highlights')
    const items = w.findAll('li')
    expect(items).toHaveLength(3)
    expect(w.text()).toContain('Software should wait quietly.')
    expect(w.text()).toContain('3 marked')
    expect(w.find('a[href="/article/10"]').exists()).toBe(true)
    // sfl badge only on the synced mark
    expect(items[0].text()).toContain('In SFL')
    expect(items[1].text()).not.toContain('In SFL')
  })

  it('derives hashtag chips from notes and filters on toggle', async () => {
    const w = await mountPage()

    const chips = w.findAll('.tag-chip')
    expect(chips.map((c) => c.text())).toEqual(['#calm', '#design'])

    await chips[1].trigger('click') // #design
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.text()).toContain('2 · #design')

    await w.find('.tag-chip-active').trigger('click') // toggle off
    expect(w.findAll('li')).toHaveLength(3)
  })

  it('renders note hashtags through renderNoteHtml (accent spans, escaped)', async () => {
    const w = await mountPage()
    expect(w.html()).toContain('<span class="note-tag">#calm</span>')
  })

  it('removes a mark: API call, row gone, toast', async () => {
    const w = await mountPage()

    await w.findAll('.hl-remove')[0].trigger('click')
    await flushPromises()

    expect(deleteHighlight).toHaveBeenCalledWith(1)
    expect(w.findAll('li')).toHaveLength(2)
    expect(showSuccess).toHaveBeenCalled()
  })

  it('failed remove keeps the row and toasts the error', async () => {
    deleteHighlight.mockRejectedValueOnce(new Error('nope'))
    const w = await mountPage()

    await w.findAll('.hl-remove')[0].trigger('click')
    await flushPromises()

    expect(w.findAll('li')).toHaveLength(3)
    expect(showError).toHaveBeenCalled()
  })

  it('shows the empty state when nothing is marked', async () => {
    fetchMock.mockResolvedValueOnce({ highlights: [] })
    const w = await mountPage()
    expect(w.text()).toContain('Nothing marked yet')
  })
})
