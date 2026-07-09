import { mount } from '@vue/test-utils'
import { defineComponent, h, ref, computed, watch, onMounted, onUnmounted } from 'vue'
import FeedPickerOverlay from '~/components/FeedPickerOverlay.vue'

// FeedPickerOverlay.vue uses Nuxt auto-imported Vue primitives which are not
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
    setup: (_, { slots }) => () => h('span', { class: 'mono-label' }, slots.default?.()),
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

const feeds = [
  { url: 'https://www.vg.no/rss/feed/?format=rss', title: 'VG - Alle saker', type: 'rss' as const },
  { url: 'https://www.vg.no/rss/sport', title: 'VG - Sport', type: 'rss' as const },
]

function mountOverlay(props: Partial<{ addedUrls: string[]; busyUrl: string | null }> = {}) {
  return mount(FeedPickerOverlay, {
    props: { feeds, addedUrls: [], busyUrl: null, ...props },
    global: { stubs },
  })
}

const rows = (w: ReturnType<typeof mountOverlay>) => w.findAll('.feed-option')

describe('FeedPickerOverlay', () => {
  it('renders one row per feed with title and url, plus the source host', () => {
    const w = mountOverlay()
    const r = rows(w)
    expect(r).toHaveLength(2)
    expect(r[0].text()).toContain('VG - Alle saker')
    expect(r[0].text()).toContain('https://www.vg.no/rss/feed/?format=rss')
    expect(w.text()).toContain('vg.no offers more than one feed')
  })

  it('clicking Add emits add with the row feed', async () => {
    const w = mountOverlay()
    await rows(w)[1].find('[data-testid="action-accent"]').trigger('click')
    expect(w.emitted('add')).toEqual([[feeds[1]]])
  })

  it('an added feed shows the Added label instead of a button', () => {
    const w = mountOverlay({ addedUrls: [feeds[0].url] })
    expect(rows(w)[0].find('[data-testid="action-accent"]').exists()).toBe(false)
    expect(rows(w)[0].text()).toContain('Added')
    expect(rows(w)[1].find('[data-testid="action-accent"]').exists()).toBe(true)
  })

  it('while one add is busy all Add buttons are disabled and the busy row says Adding…', async () => {
    const w = mountOverlay({ busyUrl: feeds[0].url })
    const buttons = w.findAll('[data-testid="action-accent"]')
    expect(buttons[0].text()).toContain('Adding…')
    expect(buttons.every((b) => (b.element as HTMLButtonElement).disabled)).toBe(true)
    await buttons[1].trigger('click')
    expect(w.emitted('add')).toBeUndefined()
  })

  it('footer reads Cancel before any add and Done after', () => {
    expect(mountOverlay().find('[data-testid="action-plain"]').text()).toBe('Cancel')
    expect(
      mountOverlay({ addedUrls: [feeds[0].url] }).find('[data-testid="action-plain"]').text()
    ).toBe('Done')
  })

  it('Escape on window and the footer button both emit close; Esc stops after unmount', async () => {
    const w = mountOverlay()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('close')).toHaveLength(1)

    await w.find('[data-testid="action-plain"]').trigger('click')
    const closeEvents = w.emitted('close')!
    expect(closeEvents).toHaveLength(2)

    w.unmount()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(closeEvents).toHaveLength(2)
  })
})
