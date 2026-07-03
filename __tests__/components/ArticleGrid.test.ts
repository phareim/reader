import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import ArticleGrid from '~/components/grid/ArticleGrid.vue'
// Shares the module instance jest maps 'motion-v' to (moduleNameMapper).
import { __setManualAnimations, __resolveAnimations } from '~/__tests__/mocks/motion-v'

const saveArticle = jest.fn().mockResolvedValue(undefined)
const unsaveArticle = jest.fn().mockResolvedValue(undefined)
const markAsRead = jest.fn().mockResolvedValue(undefined)
const showError = jest.fn()

// Nuxt auto-imported composables don't exist under Jest — provide globals.
;(globalThis as any).useSavedArticles = () => ({ saveArticle, unsaveArticle })
;(globalThis as any).useArticles = () => ({ markAsRead })
;(globalThis as any).useToast = () => ({ showError })
;(globalThis as any).navigateTo = jest.fn()

// ---------------------------------------------------------------------------
// IntersectionObserver mock — jsdom has none. Records instances so tests can
// fire the callback by hand.
// ---------------------------------------------------------------------------
let ioInstances: Array<{ cb: (entries: any[]) => void; observed: Element[] }> = []

class MockIntersectionObserver {
  cb: (entries: any[]) => void
  observed: Element[] = []
  constructor(cb: (entries: any[]) => void, _opts?: any) {
    this.cb = cb
    ioInstances.push(this)
  }
  observe(el: Element) { this.observed.push(el) }
  unobserve(el: Element) { this.observed = this.observed.filter((e) => e !== el) }
  disconnect() { this.observed = [] }
}
;(globalThis as any).IntersectionObserver = MockIntersectionObserver

const stubs = {
  MiniCard: defineComponent({
    props: ['article'],
    setup: (p: any) => () => h('div', { 'data-testid': `mini-${p.article.id}` }, `mini-${p.article.id}`),
  }),
  DeckEmptyState: defineComponent({
    setup: () => () => h('div', { 'data-testid': 'empty-state' }),
  }),
  UndoToast: defineComponent({
    props: ['visible', 'label'],
    setup: (p: any) => () =>
      h('div', { 'data-testid': 'undo-toast', 'data-visible': String(p.visible), 'data-label': p.label }),
  }),
  ActionLabel: true,
  MonoLabel: true,
}

const articles = [
  { id: 1, title: 'One', feedTitle: 'Feed', isRead: false },
  { id: 2, title: 'Two', feedTitle: 'Feed', isRead: false },
  { id: 3, title: 'Three', feedTitle: 'Feed', isRead: false },
] as any[]

function mountGrid(props: Partial<Record<string, any>> = {}) {
  return mount(ArticleGrid, {
    props: { articles, hasMore: false, loadingMore: false, ...props },
    global: { stubs },
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  ioInstances = []
  __setManualAnimations(false)
})

describe('ArticleGrid commit wiring', () => {
  it('left commit saves the card', async () => {
    const w = mountGrid()
    await (w.vm as any).commitCard(1, 'left')
    await flushPromises()
    expect(saveArticle).toHaveBeenCalledWith(1)
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.find('[data-testid="undo-toast"]').attributes('data-visible')).toBe('true')
    expect(w.find('[data-testid="undo-toast"]').attributes('data-label')).toBe('Save')
  })

  it('right commit marks read', async () => {
    const w = mountGrid()
    await (w.vm as any).commitCard(2, 'right')
    await flushPromises()
    expect(markAsRead).toHaveBeenCalledWith(2, true)
    expect(saveArticle).not.toHaveBeenCalled()
    expect(w.find('[data-testid="undo-toast"]').attributes('data-label')).toBe('Read')
  })

  it('a second commit during an in-flight commit is ignored', async () => {
    __setManualAnimations(true)
    const w = mountGrid()
    const first = (w.vm as any).commitCard(1, 'left')
    const second = (w.vm as any).commitCard(2, 'right') // busy → no-op
    __resolveAnimations()
    await first
    await second
    await flushPromises()
    expect(saveArticle).toHaveBeenCalledTimes(1)
    expect(markAsRead).not.toHaveBeenCalled()
  })

  it('undo after save unsaves; undo after read marks unread (LIFO)', async () => {
    const w = mountGrid()
    await (w.vm as any).commitCard(1, 'left')
    await (w.vm as any).commitCard(2, 'right')
    await flushPromises()

    await (w.vm as any).undo()
    expect(markAsRead).toHaveBeenLastCalledWith(2, false)

    await (w.vm as any).undo()
    expect(unsaveArticle).toHaveBeenCalledWith(1)

    // History drained — a third undo is a no-op.
    unsaveArticle.mockClear()
    markAsRead.mockClear()
    await (w.vm as any).undo()
    expect(unsaveArticle).not.toHaveBeenCalled()
    expect(markAsRead).not.toHaveBeenCalled()
  })

  it('tap navigates to the reader', async () => {
    const w = mountGrid()
    await w.find('[data-testid="mini-2"]').trigger('click')
    expect((globalThis as any).navigateTo).toHaveBeenCalledWith('/article/2')
  })
})

describe('ArticleGrid infinite scroll', () => {
  it('observes the sentinel when hasMore and emits loadMore on intersection', async () => {
    const w = mountGrid({ hasMore: true })
    await flushPromises()
    await w.vm.$nextTick()

    expect(ioInstances.length).toBeGreaterThan(0)
    const io = ioInstances[ioInstances.length - 1]
    expect(io.observed.length).toBe(1)

    io.cb([{ isIntersecting: true }])
    expect(w.emitted('loadMore')).toHaveLength(1)

    // A non-intersecting tick does not emit.
    io.cb([{ isIntersecting: false }])
    expect(w.emitted('loadMore')).toHaveLength(1)
  })

  it('creates no observer when hasMore is false', async () => {
    mountGrid({ hasMore: false })
    await flushPromises()
    expect(ioInstances.every((io) => io.observed.length === 0)).toBe(true)
  })

  it('re-observes the sentinel after a load finishes so a still-visible sentinel fires again', async () => {
    const w = mountGrid({ hasMore: true })
    await flushPromises()
    await w.vm.$nextTick()
    const io = ioInstances[ioInstances.length - 1]
    const unobserve = jest.spyOn(io, 'unobserve' as any)
    const observe = jest.spyOn(io, 'observe' as any)

    await w.setProps({ loadingMore: true })
    await w.setProps({ loadingMore: false })

    expect(unobserve).toHaveBeenCalled()
    expect(observe).toHaveBeenCalled()
  })
})

describe('ArticleGrid empty state', () => {
  it('shows the empty state when there are no articles', () => {
    const w = mountGrid({ articles: [] })
    expect(w.find('[data-testid="empty-state"]').exists()).toBe(true)
  })

  it('hides the empty state when articles exist', () => {
    const w = mountGrid()
    expect(w.find('[data-testid="empty-state"]').exists()).toBe(false)
  })
})
