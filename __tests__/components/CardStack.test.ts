import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import CardStack from '~/components/stack/CardStack.vue'
// Same file jest maps 'motion-v' to (moduleNameMapper), so this shares the
// module instance the component sees — imported by path for correct typing.
import { __setManualAnimations, __resolveAnimations } from '~/__tests__/mocks/motion-v'

const saveArticle = jest.fn().mockResolvedValue(undefined)
const unsaveArticle = jest.fn().mockResolvedValue(undefined)
const markAsRead = jest.fn().mockResolvedValue(undefined)
const elevate = jest.fn().mockResolvedValue({ ideaId: 'idea-1', existing: false })
const unElevate = jest.fn().mockResolvedValue(undefined)
const showError = jest.fn()

// Nuxt auto-imported composables don't exist under Jest — provide globals.
;(globalThis as any).useSavedArticles = () => ({ saveArticle, unsaveArticle })
;(globalThis as any).useArticles = () => ({ markAsRead })
;(globalThis as any).useElevate = () => ({ elevate, unElevate })
;(globalThis as any).useToast = () => ({ showError })
;(globalThis as any).navigateTo = jest.fn()

const stubs = {
  ArticleCard: defineComponent({ props: ['article'], setup: (p: any) => () => h('div', `card-${p.article.id}`) }),
  DeckEmptyState: true,
  UndoToast: true,
  ActionLabel: true,
  MonoLabel: true,
}

const articles = [
  { id: 1, title: 'One', feedTitle: 'Feed', isRead: false },
  { id: 2, title: 'Two', feedTitle: 'Feed', isRead: false },
  { id: 3, title: 'Three', feedTitle: 'Feed', isRead: false },
] as any[]

function mountStack() {
  return mount(CardStack, { props: { articles }, global: { stubs } })
}

beforeEach(() => {
  jest.clearAllMocks()
  __setManualAnimations(false)
})

describe('CardStack commit wiring', () => {
  it('left commit saves the top card and advances', async () => {
    const w = mountStack()
    await (w.vm as any).commit('left')
    await flushPromises()
    expect(saveArticle).toHaveBeenCalledWith(1)
    expect(w.text()).toContain('card-2')
  })

  it('right commit marks read', async () => {
    const w = mountStack()
    await (w.vm as any).commit('right')
    await flushPromises()
    expect(markAsRead).toHaveBeenCalledWith(1, true)
  })

  it('down commit skips with no API call', async () => {
    const w = mountStack()
    await (w.vm as any).commit('down')
    await flushPromises()
    expect(saveArticle).not.toHaveBeenCalled()
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.text()).toContain('card-2')
  })

  it('up commit elevates then marks read', async () => {
    const w = mountStack()
    await (w.vm as any).commit('up')
    await flushPromises()
    expect(elevate).toHaveBeenCalledWith(1)
    expect(markAsRead).toHaveBeenCalledWith(1, true)
  })

  it('failed elevate keeps the card and shows an error', async () => {
    elevate.mockRejectedValueOnce(new Error('down'))
    const w = mountStack()
    await (w.vm as any).commit('up')
    await flushPromises()
    expect(showError).toHaveBeenCalled()
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.text()).toContain('card-1') // still on top
  })

  it('undo after save unsaves and restores the card', async () => {
    const w = mountStack()
    await (w.vm as any).commit('left')
    await flushPromises()
    await (w.vm as any).undo()
    await flushPromises()
    expect(unsaveArticle).toHaveBeenCalledWith(1)
    expect(w.text()).toContain('card-1')
  })

  it('undo after elevate deletes the idea only when it was newly created', async () => {
    const w = mountStack()
    await (w.vm as any).commit('up')
    await flushPromises()
    await (w.vm as any).undo()
    await flushPromises()
    expect(unElevate).toHaveBeenCalledWith(1, 'idea-1', false)
  })

  it('a second commit during an in-flight commit is ignored', async () => {
    __setManualAnimations(true)
    const w = mountStack()
    const first = (w.vm as any).commit('left')
    const second = (w.vm as any).commit('right') // busy → no-op
    __resolveAnimations()
    await first
    await second
    await flushPromises()
    expect(saveArticle).toHaveBeenCalledTimes(1)
    expect(saveArticle).toHaveBeenCalledWith(1)
    expect(markAsRead).not.toHaveBeenCalled()
    expect(w.text()).toContain('card-2') // exactly one card left the deck
  })

  it('undo during an in-flight commit is a no-op', async () => {
    __setManualAnimations(true)
    const w = mountStack()
    const inflight = (w.vm as any).commit('left')
    await (w.vm as any).undo() // busy → must not touch deck or history
    expect(unsaveArticle).not.toHaveBeenCalled()
    __resolveAnimations()
    await inflight
    await flushPromises()
    expect(unsaveArticle).not.toHaveBeenCalled()
    expect(saveArticle).toHaveBeenCalledWith(1)
    expect(w.text()).toContain('card-2') // commit landed cleanly
  })
})
