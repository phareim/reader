import { mount } from '@vue/test-utils'
import { defineComponent, h, computed } from 'vue'
import MiniCard from '~/components/grid/MiniCard.vue'
import ArticleCard from '~/components/stack/ArticleCard.vue'

// MiniCard imports computed explicitly, but provide the auto-import global
// anyway for symmetry with the other component suites.
;(globalThis as any).computed = computed

const stubs = {
  CardFrame: defineComponent({
    setup: (_, { slots }) => () => h('div', { 'data-testid': 'card-frame' }, slots.default?.()),
  }),
  MonoLabel: defineComponent({
    props: { dash: Boolean, accent: Boolean },
    setup: (_, { slots }) => () => h('span', slots.default?.()),
  }),
  HairlineRule: defineComponent({
    setup: () => () => h('hr', { 'data-testid': 'hairline' }),
  }),
  // Render nothing so the image-variant tests' `find('img')` still targets
  // the lead image, not the tiny favicon.
  FeedFavicon: defineComponent({
    props: { src: String, size: Number },
    setup: () => () => null,
  }),
}

const baseArticle = {
  id: 7,
  feedId: 1,
  feedTitle: 'The Feed',
  guid: 'g-7',
  title: 'A headline worth scanning',
  isRead: false,
  isStarred: false,
  publishedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2h ago
} as any

function mountCard(article = baseArticle) {
  return mount(MiniCard, { props: { article }, global: { stubs } })
}

describe('MiniCard', () => {
  it('renders the image variant when the article has a usable image', () => {
    const w = mountCard({ ...baseArticle, imageUrl: 'https://example.com/lead.jpg' })
    const img = w.find('img')
    expect(img.exists()).toBe(true)
    // Through the resizing proxy (utils/imageProxy.ts).
    expect(img.attributes('src')).toBe(`/api/img?w=480&u=${encodeURIComponent('https://example.com/lead.jpg')}`)
    // Image variant carries no typographic hairline head
    expect(w.find('[data-testid="hairline"]').exists()).toBe(false)
  })

  it('falls back to the typographic variant when the image is Unsplash filler', () => {
    const w = mountCard({ ...baseArticle, imageUrl: 'https://images.unsplash.com/photo-123' })
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('[data-testid="hairline"]').exists()).toBe(true)
  })

  it('renders the typographic variant when there is no image', () => {
    const w = mountCard()
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('[data-testid="hairline"]').exists()).toBe(true)
    expect(w.text()).toContain('A headline worth scanning')
  })

  it('footer carries feed title and relative age, and no excerpt', () => {
    const w = mountCard({ ...baseArticle, summary: 'A long excerpt that must NOT appear on mini cards' })
    expect(w.text()).toContain('The Feed')
    expect(w.text()).toMatch(/hour/) // formatRelativeDate: "2 hours ago"
    expect(w.text()).not.toContain('excerpt that must NOT appear')
  })
})

// Both surfaces must remain readable when publishers remove a lead image.
describe.each([['MiniCard', MiniCard], ['ArticleCard', ArticleCard]])('%s image recovery', (_, component) => {
  it('keeps the headline and returns to paper after an image fails, then accepts a new image', async () => {
    const article = { ...baseArticle, imageUrl: 'https://example.com/missing.jpg' }
    const w = mount(component, { props: { article }, global: { stubs } })
    await w.get('img').trigger('error')
    expect(w.find('img').exists()).toBe(false)
    expect(w.text()).toContain(article.title)
    expect(w.find('[data-testid="hairline"]').exists()).toBe(true)
    await w.setProps({ article: { ...article, imageUrl: 'https://example.com/replacement.jpg' } })
    expect(w.get('img').attributes('src')).toContain(encodeURIComponent('https://example.com/replacement.jpg'))
  })
})
