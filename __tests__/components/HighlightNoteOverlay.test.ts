import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, onMounted, onUnmounted } from 'vue'
import HighlightNoteOverlay from '~/components/HighlightNoteOverlay.vue'

// Provide Nuxt auto-imported Vue primitives on globalThis (not injected under Jest).
;(globalThis as any).ref = ref
;(globalThis as any).onMounted = onMounted
;(globalThis as any).onUnmounted = onUnmounted

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
          'data-testid': p.accent ? 'save' : 'cancel',
          disabled: p.disabled,
          onClick: () => emit('click'),
        },
        slots.default?.(),
      ),
  }),
}

function mountOverlay(props: Record<string, unknown> = {}) {
  return mount(HighlightNoteOverlay, {
    props: { quote: 'a marked passage', ...props },
    global: { stubs },
  })
}

describe('HighlightNoteOverlay', () => {
  it('renders the quoted passage', () => {
    const wrapper = mountOverlay()
    expect(wrapper.find('blockquote').text()).toBe('a marked passage')
  })

  it('emits save with the trimmed note text', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('textarea').setValue('  great on #programming  ')
    await wrapper.find('[data-testid="save"]').trigger('click')

    expect(wrapper.emitted('save')).toEqual([['great on #programming']])
  })

  it('emits close on Cancel', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('[data-testid="cancel"]').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(1)
  })

  it('commits on Cmd/Ctrl+Enter but not on plain Enter', async () => {
    const wrapper = mountOverlay()
    await wrapper.find('textarea').setValue('note')

    await wrapper.find('textarea').trigger('keydown', { key: 'Enter' })
    expect(wrapper.emitted('save')).toBeUndefined()

    await wrapper.find('textarea').trigger('keydown', { key: 'Enter', metaKey: true })
    expect(wrapper.emitted('save')).toEqual([['note']])
  })

  it('does not emit save while already saving', async () => {
    const wrapper = mountOverlay({ saving: true })
    await wrapper.find('[data-testid="save"]').trigger('click')
    expect(wrapper.emitted('save')).toBeUndefined()
  })
})
