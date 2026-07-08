import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import RsvpOverlay from '~/components/RsvpOverlay.vue'
import { RSVP } from '~/utils/rsvp'

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
    setup: (_, { slots, emit, attrs }) => () =>
      h('button', { ...attrs, onClick: () => emit('click') }, slots.default?.()),
  }),
}

const WORDS = ['A', 'calm', 'reader', 'reads', 'one', 'word', 'at', 'a', 'time.']

function mountOverlay(words: string[] = WORDS) {
  return mount(RsvpOverlay, { props: { words }, global: { stubs } })
}

function key(k: string) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }))
}

function control(wrapper: ReturnType<typeof mount>, label: string) {
  return wrapper.findAll('button').filter((b) => b.text() === label)[0]
}

beforeEach(() => {
  jest.useFakeTimers()
  localStorage.clear()
})
afterEach(() => {
  jest.useRealTimers()
})

describe('RsvpOverlay', () => {
  it('renders the first word split around the ORP letter', () => {
    const wrapper = mountOverlay(['reader'])
    expect(wrapper.find('.pre').text()).toBe('re')
    expect(wrapper.find('.orp').text()).toBe('a')
    expect(wrapper.find('.post').text()).toBe('der')
  })

  it('plays through the words on tap and lands in the done state', async () => {
    const wrapper = mountOverlay(['one', 'two', 'three'])
    await wrapper.find('.rsvp-stage').trigger('click')

    jest.advanceTimersByTime(60000 / RSVP.WPM_DEFAULT + 5)
    await Promise.resolve()
    expect(wrapper.find('.rsvp-word').text()).toBe('two')

    jest.runAllTimers()
    await Promise.resolve()
    expect(wrapper.find('.rsvp-word').text()).toBe('three')
    expect(wrapper.text()).toContain('Done')
    expect(control(wrapper, 'Restart')).toBeDefined()
  })

  it('pauses on space and resumes without losing the place', async () => {
    const wrapper = mountOverlay(['one', 'two', 'three'])
    key(' ') // play
    jest.advanceTimersByTime(60000 / RSVP.WPM_DEFAULT + 5)
    key(' ') // pause
    jest.advanceTimersByTime(10000)
    await Promise.resolve()
    expect(wrapper.find('.rsvp-word').text()).toBe('two')
  })

  it('restart rewinds to the first word and plays again', async () => {
    const wrapper = mountOverlay(['one', 'two'])
    await wrapper.find('.rsvp-stage').trigger('click')
    jest.runAllTimers()
    await Promise.resolve()

    await control(wrapper, 'Restart')!.trigger('click')
    expect(wrapper.find('.rsvp-word').text()).toBe('one')
  })

  it('adjusts wpm with the arrow keys, clamped to the bounds', async () => {
    const wrapper = mountOverlay()
    key('ArrowUp')
    await Promise.resolve()
    expect(wrapper.text()).toContain(`${RSVP.WPM_DEFAULT + RSVP.WPM_STEP} wpm`)

    for (let i = 0; i < 100; i++) key('ArrowDown')
    await Promise.resolve()
    expect(wrapper.text()).toContain(`${RSVP.WPM_MIN} wpm`)
  })

  it('persists the chosen wpm to localStorage', async () => {
    const wrapper = mountOverlay()
    await control(wrapper, 'Faster')!.trigger('click')
    await Promise.resolve()
    expect(localStorage.getItem('reader:rsvpWpm')).toBe(String(RSVP.WPM_DEFAULT + RSVP.WPM_STEP))
  })

  it('skips forward and back in word jumps, clamped to the stream', async () => {
    const wrapper = mountOverlay(WORDS)
    key('ArrowRight')
    await Promise.resolve()
    expect(wrapper.find('.rsvp-word').text()).toBe(WORDS[WORDS.length - 1]) // +10 clamps to last

    key('ArrowLeft')
    await Promise.resolve()
    expect(wrapper.find('.rsvp-word').text()).toBe(WORDS[0]) // −10 clamps to first
  })

  it('emits close on Escape and on the Close control', async () => {
    const wrapper = mountOverlay()
    key('Escape')
    await control(wrapper, 'Close')!.trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
  })
})
