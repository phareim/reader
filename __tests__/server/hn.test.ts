import { parseFavoriteIds, hasMoreFavorites, renderHnItem } from '../../server/utils/hn'

describe('parseFavoriteIds', () => {
  it('extracts ids from favorites-page rows in order, both quote styles', () => {
    const html = `
      <table>
        <tr class='athing submission' id='44001111'><td>…</td></tr>
        <tr class="athing" id="44002222"><td>…</td></tr>
        <tr class='spacer'></tr>
        <tr class='athing submission' id='44003333'><td>…</td></tr>
      </table>`
    expect(parseFavoriteIds(html)).toEqual(['44001111', '44002222', '44003333'])
  })

  it('returns empty for a page with no favorites', () => {
    expect(parseFavoriteIds('<html><body>No favorites yet.</body></html>')).toEqual([])
  })
})

describe('hasMoreFavorites', () => {
  it('detects the More link', () => {
    expect(hasMoreFavorites(`<a href="favorites?id=x&p=2" class='morelink' rel='next'>More</a>`)).toBe(true)
    expect(hasMoreFavorites('<html>no pager</html>')).toBe(false)
  })
})

describe('renderHnItem', () => {
  it('renders a link story: external URL as card link, HN thread in body', () => {
    const item = renderHnItem({
      id: 44001111,
      type: 'story',
      by: 'pg',
      time: 1751500800,
      title: 'A calm RSS reader',
      url: 'https://www.example.com/reader',
      score: 142,
      descendants: 87,
    })!
    expect(item.source).toBe('hn-favorite')
    expect(item.externalId).toBe('44001111')
    expect(item.url).toBe('https://www.example.com/reader')
    expect(item.title).toBe('A calm RSS reader')
    expect(item.author).toBe('pg')
    expect(item.content).toContain('<strong>A calm RSS reader</strong>')
    expect(item.content).toContain('pg · 142 points · 2025-07-03')
    expect(item.content).toContain('<a href="https://www.example.com/reader">example.com →</a>')
    expect(item.content).toContain('87 comments on Hacker News →')
    expect(item.content).toContain('news.ycombinator.com/item?id=44001111')
  })

  it('renders an Ask HN (text story): HN link as card link, text as body', () => {
    const item = renderHnItem({
      id: 44002222,
      type: 'story',
      by: 'asker',
      time: 1751500800,
      title: 'Ask HN: Favorite reading setup?',
      text: '<p>Curious what people use.</p>',
    })!
    expect(item.url).toBe('https://news.ycombinator.com/item?id=44002222')
    expect(item.content).toContain('<p>Curious what people use.</p>')
    expect(item.summary).toBe('Curious what people use.')
  })

  it('skips comments, deleted, and dead items', () => {
    expect(renderHnItem({ id: 1, type: 'comment', text: 'a comment' })).toBeNull()
    expect(renderHnItem({ id: 2, type: 'story', deleted: true })).toBeNull()
    expect(renderHnItem({ id: 3, type: 'story', dead: true })).toBeNull()
    expect(renderHnItem(null)).toBeNull()
  })

  it('escapes HTML in titles', () => {
    const item = renderHnItem({ id: 4, type: 'story', title: 'Show HN: <script> & friends' })!
    expect(item.content).toContain('&lt;script&gt; &amp; friends')
  })
})
