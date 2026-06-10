import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import TagEditorOverlay from '~/components/TagEditorOverlay.vue'

// TagEditorOverlay.vue uses Nuxt auto-imported Vue primitives which are not
// injected into the component scope under Jest. Provide them on globalThis so
// the compiled component's setup() can resolve them.
;(globalThis as any).ref = ref
;(globalThis as any).computed = computed
;(globalThis as any).watch = watch
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

// ---------------------------------------------------------------------------
// Child-component stubs (Teleport stubbed so content renders in place)
// ---------------------------------------------------------------------------
const stubs = {
  teleport: true,
  MonoLabel: defineComponent({
    props: { dash: Boolean, accent: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  HairlineRule: true,
  ActionLabel: defineComponent({
    props: { accent: Boolean, disabled: Boolean },
    emits: ['click'],
    setup: (p: any, { slots, emit }) => () =>
      h(
        'button',
        { 'data-testid': p.accent ? 'action-accent' : 'action-plain', onClick: () => emit('click') },
        slots.default?.()
      ),
  }),
}

const feed = { id: 1, title: 'Feed', tags: ['tech', 'news'] } as any
const allTags = ['ai', 'news', 'tech', 'tools']

function mountOverlay() {
  return mount(TagEditorOverlay, {
    props: { feed, allTags },
    global: { stubs },
  })
}

// Chip text uses &nbsp; before the × — normalize so assertions can use plain spaces.
const chips = (w: ReturnType<typeof mountOverlay>) => w.findAll('.tag-chip')
const chipTexts = (w: ReturnType<typeof mountOverlay>) =>
  chips(w).map((b) => b.text().replace(/ /g, ' '))
const suggestions = (w: ReturnType<typeof mountOverlay>) => w.findAll('.suggestion')
const input = (w: ReturnType<typeof mountOverlay>) => w.find('input')

afterEach(() => {
  jest.clearAllMocks()
})

describe('TagEditorOverlay', () => {
  it('renders the feed title and one chip per current tag', () => {
    const w = mountOverlay()
    expect(w.text()).toContain('Feed')
    const c = chips(w)
    expect(c).toHaveLength(2)
    expect(c[0].text()).toContain('tech')
    expect(c[1].text()).toContain('news')
  })

  it('empty query — suggestions are all unselected tags', () => {
    const w = mountOverlay()
    const s = suggestions(w)
    expect(s.map((b) => b.text())).toEqual(['ai', 'tools'])
  })

  it('typing filters suggestions case-insensitively', async () => {
    const w = mountOverlay()
    await input(w).setValue('TO')
    expect(suggestions(w).map((b) => b.text())).toEqual(['tools'])
  })

  it('Enter with no highlight commits the typed text and clears the input', async () => {
    const w = mountOverlay()
    await input(w).setValue('design')
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(chipTexts(w)).toContain('design ×')
    expect((input(w).element as HTMLInputElement).value).toBe('')
  })

  it('comma commits the typed text', async () => {
    const w = mountOverlay()
    await input(w).setValue('design')
    await input(w).trigger('keydown', { key: ',' })
    expect(chips(w)).toHaveLength(3)
    expect((input(w).element as HTMLInputElement).value).toBe('')
  })

  it('ArrowDown then Enter adds the first suggestion, which leaves the list', async () => {
    const w = mountOverlay()
    await input(w).trigger('keydown', { key: 'ArrowDown' })
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(chipTexts(w)).toContain('ai ×')
    expect(suggestions(w).map((b) => b.text())).toEqual(['tools'])
  })

  it('clicking a suggestion adds it', async () => {
    const w = mountOverlay()
    await suggestions(w)[1].trigger('click') // 'tools'
    expect(chipTexts(w)).toContain('tools ×')
    expect(suggestions(w).map((b) => b.text())).toEqual(['ai'])
  })

  it('clicking a chip removes that tag', async () => {
    const w = mountOverlay()
    await chips(w)[0].trigger('click') // 'tech'
    expect(chipTexts(w)).toEqual(['news ×'])
    // removed tag becomes suggestible again
    expect(suggestions(w).map((b) => b.text())).toEqual(['ai', 'tech', 'tools'])
  })

  it('Backspace on empty input removes the last chip; with text it does not', async () => {
    const w = mountOverlay()
    await input(w).trigger('keydown', { key: 'Backspace' })
    expect(chips(w)).toHaveLength(1)

    await input(w).setValue('x')
    await input(w).trigger('keydown', { key: 'Backspace' })
    expect(chips(w)).toHaveLength(1)
  })

  it('adding a case-insensitive duplicate is a no-op and clears the input', async () => {
    const w = mountOverlay()
    await input(w).setValue('TECH')
    await input(w).trigger('keydown', { key: 'Enter' })
    expect(chips(w)).toHaveLength(2)
    expect((input(w).element as HTMLInputElement).value).toBe('')
  })

  it('Save emits save with the current draft', async () => {
    const w = mountOverlay()
    await input(w).setValue('design')
    await input(w).trigger('keydown', { key: 'Enter' })
    await w.find('[data-testid="action-accent"]').trigger('click')
    expect(w.emitted('save')).toEqual([[['tech', 'news', 'design']]])
  })

  it('Escape on window and Cancel both emit close; Esc stops after unmount', async () => {
    const w = mountOverlay()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)

    await w.find('[data-testid="action-plain"]').trigger('click')
    const closeEvents = w.emitted('close')!
    expect(closeEvents).toHaveLength(2)

    // unmount removes the window listener — a further Esc must not emit
    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closeEvents).toHaveLength(2)
  })
})
