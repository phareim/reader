import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ShelfPage from '~/pages/shelf.vue'

const saveArticle = jest.fn().mockResolvedValue(undefined)
const unsaveArticle = jest.fn().mockResolvedValue(undefined)
const markAsRead = jest.fn().mockResolvedValue(undefined)
const showError = jest.fn()
const showSuccess = jest.fn()

// Nuxt auto-imported composables don't exist under Jest — provide globals.
;(globalThis as any).useSavedArticles = () => ({ saveArticle, unsaveArticle })
;(globalThis as any).useArticles = () => ({ markAsRead })
;(globalThis as any).useToast = () => ({ showError, showSuccess })

const ROWS = [
  {
    id: 10,
    feedId: 1,
    feedTitle: 'Blog',
    feedFavicon: null,
    title: 'On calm software',
    url: 'https://example.com/calm',
    content: null,
    summary: 'Software should wait quietly for its person.',
    publishedAt: '2026-07-03T00:00:00Z',
    isRead: false,
    tags: [],
  },
  {
    id: 11,
    feedId: 2,
    feedTitle: 'Essays',
    feedFavicon: null,
    title: 'Deep work',
    url: null,
    content: null,
    summary: null,
    publishedAt: null,
    isRead: true,
    tags: ['focus'],
  },
] as any[]

let fetchMock: jest.Mock

beforeEach(() => {
  jest.clearAllMocks()
  fetchMock = jest.fn((url: string) =>
    Promise.resolve(url === '/api/saved-articles' ? { articles: ROWS.map((r) => ({ ...r })) } : { articles: [] })
  )
  ;(globalThis as any).$fetch = fetchMock
})

const stubs = {
  MonoLabel: defineComponent({
    props: { dash: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  HairlineRule: true,
  FeedFavicon: true,
  NuxtLink: defineComponent({
    props: ['to'],
    setup: (p: any, { slots }) => () => h('a', { href: p.to }, slots.default?.()),
  }),
  UndoToast: defineComponent({
    props: ['visible', 'label'],
    setup: (p: any) => () =>
      h('div', { 'data-testid': 'undo-toast', 'data-visible': String(p.visible), 'data-label': p.label }),
  }),
  ActionLabel: defineComponent({
    emits: ['click'],
    setup: (_, { emit, slots }) => () =>
      h('button', { class: 'action-label-stub', onClick: () => emit('click') }, slots.default?.()),
  }),
}

const mountPage = async () => {
  const w = mount(ShelfPage, { global: { stubs } })
  await flushPromises()
  return w
}

describe('pages/shelf.vue', () => {
  it('lists saved articles with feed, title, and article link', async () => {
    const w = await mountPage()

    expect(fetchMock).toHaveBeenCalledWith('/api/saved-articles')
    expect(w.findAll('li')).toHaveLength(2)
    expect(w.text()).toContain('On calm software')
    expect(w.text()).toContain('2 saved')
    expect(w.find('a[href="/article/10"]').exists()).toBe(true)
    expect(w.find('a[href="/article/11"]').exists()).toBe(true)
  })

  it('swipe-left commit marks read, unsaves, removes the row, shows undo', async () => {
    const w = await mountPage()

    await (w.vm as any).commitRow(ROWS[0])
    await flushPromises()

    expect(markAsRead).toHaveBeenCalledWith(10, true)
    expect(unsaveArticle).toHaveBeenCalledWith(10)
    expect(w.findAll('li')).toHaveLength(1)
    expect(w.find('[data-testid="undo-toast"]').attributes('data-visible')).toBe('true')
    expect(w.find('[data-testid="undo-toast"]').attributes('data-label')).toBe('Read')
  })

  it('an already-read row is only unsaved — no redundant mark-read', async () => {
    const w = await mountPage()

    await (w.vm as any).commitRow(ROWS[1])
    await flushPromises()

    expect(markAsRead).not.toHaveBeenCalled()
    expect(unsaveArticle).toHaveBeenCalledWith(11)
    expect(w.findAll('li')).toHaveLength(1)
  })

  it('undo restores the row at its position, resaves, and marks unread only if it was unread', async () => {
    const w = await mountPage()

    await (w.vm as any).commitRow(ROWS[0])
    await flushPromises()
    markAsRead.mockClear()

    await (w.vm as any).performUndo()
    await flushPromises()

    const items = w.findAll('li')
    expect(items).toHaveLength(2)
    expect(items[0].text()).toContain('On calm software')
    expect(saveArticle).toHaveBeenCalledWith(10)
    expect(markAsRead).toHaveBeenCalledWith(10, false)
  })

  it('undoing an archived already-read row never marks it unread', async () => {
    const w = await mountPage()

    await (w.vm as any).commitRow(ROWS[1])
    await flushPromises()

    await (w.vm as any).performUndo()
    await flushPromises()

    expect(saveArticle).toHaveBeenCalledWith(11)
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.findAll('li')).toHaveLength(2)
  })

  it('the Remove button still unsaves without touching read state', async () => {
    const w = await mountPage()

    const remove = w.findAll('button').find((b) => b.text().includes('Remove'))!
    await remove.trigger('click')
    await flushPromises()

    expect(unsaveArticle).toHaveBeenCalledWith(10)
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.findAll('li')).toHaveLength(1)
    expect(showSuccess).toHaveBeenCalled()
  })
})
