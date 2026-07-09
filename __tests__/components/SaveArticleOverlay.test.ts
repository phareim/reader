import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import SaveArticleOverlay from '~/components/SaveArticleOverlay.vue'

// SaveArticleOverlay.vue uses Nuxt auto-imported Vue primitives which are not
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
        {
          'data-testid': p.accent ? 'action-accent' : 'action-plain',
          disabled: p.disabled,
          onClick: () => !p.disabled && emit('click'),
        },
        slots.default?.()
      ),
  }),
}

const article = {
  title: 'A Fine Article',
  url: 'https://example.com/a-fine-article',
  author: 'Jane Writer',
  description: 'A short description.',
}

function mountOverlay(props: Partial<{ article: any; saving: boolean }> = {}) {
  return mount(SaveArticleOverlay, {
    props: { article, saving: false, ...props },
    global: { stubs },
  })
}

describe('SaveArticleOverlay', () => {
  it('renders title, author, url, and description', () => {
    const w = mountOverlay()
    expect(w.text()).toContain('A Fine Article')
    expect(w.text()).toContain('Jane Writer')
    expect(w.text()).toContain('https://example.com/a-fine-article')
    expect(w.text()).toContain('A short description.')
  })

  it('omits author and description when absent', () => {
    const w = mountOverlay({ article: { title: 'Bare', url: 'https://example.com/' } })
    expect(w.text()).toContain('Bare')
    expect(w.text()).not.toContain('Jane Writer')
  })

  it('Save emits save; Cancel emits close', async () => {
    const w = mountOverlay()
    await w.find('[data-testid="action-accent"]').trigger('click')
    expect(w.emitted('save')).toHaveLength(1)
    await w.find('[data-testid="action-plain"]').trigger('click')
    expect(w.emitted('close')).toHaveLength(1)
  })

  it('while saving both buttons are disabled and the label reads Saving…', async () => {
    const w = mountOverlay({ saving: true })
    const save = w.find('[data-testid="action-accent"]')
    expect(save.text()).toContain('Saving…')
    expect((save.element as HTMLButtonElement).disabled).toBe(true)
    expect((w.find('[data-testid="action-plain"]').element as HTMLButtonElement).disabled).toBe(true)
    await save.trigger('click')
    expect(w.emitted('save')).toBeUndefined()
  })

  it('Escape on window emits close; stops after unmount', () => {
    const w = mountOverlay()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    const closeEvents = w.emitted('close')!
    expect(closeEvents).toHaveLength(1)

    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closeEvents).toHaveLength(1)
  })
})
