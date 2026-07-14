import { mount } from '@vue/test-utils'
import { defineComponent, h, computed, ref } from 'vue'
import BottomBar from '~/components/BottomBar.vue'

;(globalThis as any).computed = computed

function mountWith(
  routeName: string,
  routePath = '/',
  feeds: any[] = [{ id: 1, kind: 'found' }],
  auth: { loggedIn?: boolean; checked?: boolean } = {},
) {
  ;(globalThis as any).useRoute = () => ({ name: routeName, path: routePath })
  ;(globalThis as any).useFeeds = () => ({ feeds: ref(feeds) })
  ;(globalThis as any).useAuth = () => ({
    loggedIn: ref(auth.loggedIn ?? true),
    checked: ref(auth.checked ?? true),
  })
  return mount(BottomBar, {
    global: {
      stubs: {
        NuxtLink: defineComponent({
          props: ['to'],
          setup: (p: any, { slots }) => () =>
            h('a', { href: p.to, 'data-to': p.to }, slots.default?.()),
        }),
      },
    },
  })
}

afterEach(() => jest.clearAllMocks())

describe('BottomBar', () => {
  it('renders all four rooms including Found, in order', () => {
    const w = mountWith('index', '/')
    const labels = w.findAll('a').map(a => a.text())
    expect(labels).toEqual(['Deck', 'Found', 'Shelf', 'Sources'])
  })

  it('hides Found for an account without a found feed', () => {
    const w = mountWith('index', '/', [{ id: 1, kind: 'rss' }])
    const labels = w.findAll('a').map(a => a.text())
    expect(labels).toEqual(['Deck', 'Shelf', 'Sources'])
  })

  it('keeps Found visible while standing in the room, even without the feed', () => {
    const w = mountWith('found', '/found', [])
    const labels = w.findAll('a').map(a => a.text())
    expect(labels).toEqual(['Deck', 'Found', 'Shelf', 'Sources'])
  })

  it('marks Found active only on the found route', () => {
    const w = mountWith('found', '/found')
    const found = w.findAll('a').find(a => a.text() === 'Found')!
    const deck = w.findAll('a').find(a => a.text() === 'Deck')!
    expect(found.classes()).toContain('text-accent-ink')
    expect(deck.classes()).not.toContain('text-accent-ink')
  })

  it('Found is not active when on the deck', () => {
    const w = mountWith('index', '/')
    const found = w.findAll('a').find(a => a.text() === 'Found')!
    expect(found.classes()).not.toContain('text-accent-ink')
  })

  it('hides itself on the article reader and login', () => {
    expect(mountWith('article-id', '/article/1').find('nav').exists()).toBe(false)
    expect(mountWith('login', '/login').find('nav').exists()).toBe(false)
  })

  it('hides itself for a definitely-signed-out visitor, but not while checking', () => {
    expect(mountWith('index', '/', [], { loggedIn: false, checked: true }).find('nav').exists()).toBe(false)
    expect(mountWith('index', '/', [], { loggedIn: false, checked: false }).find('nav').exists()).toBe(true)
  })
})
