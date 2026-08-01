import { cleanEmailHtml, stripTextForwardHeader } from '~/server/utils/emailClean'
import { viewInBrowserLink } from '~/server/utils/emailIngest'

// A trimmed-down real Gmail-forwarded TLDR issue: forward block, hidden
// preheader with zero-width padding, nav row, nested layout tables, a
// story block, and the trailing tracking pixel.
const TLDR_HTML = `<div dir="ltr"><br><br><div class="gmail_quote gmail_quote_container"><div dir="ltr" class="gmail_attr">---------- Forwarded message ---------<br>From: <strong class="gmail_sendername" dir="auto">TLDR</strong> <span dir="auto">&lt;<a href="mailto:dan@tldrnewsletter.com">dan@tldrnewsletter.com</a>&gt;</span><br>Date: Fri, Jul 17, 2026 at 1:19 PM<br>Subject: xAI chaos 🔥<br>To:  &lt;<a href="mailto:phareim@gmail.com">phareim@gmail.com</a>&gt;<br></div><br><br><div class="msg716">
<div style="display:none;max-height:0px;overflow:hidden">One of SpaceXAI's goals is to get Grok to catch up to Anthropic's Claude ‌ ‌ ‌ ‌ ‌ ‌ ‌ ‌</div>
<table align="center" class="m_716document"><tbody><tr><td valign="top">
<table align="center" border="0" cellpadding="0" cellspacing="0" width="600"><tbody><tr><td>
<div style="text-align:center"><a href="https://tldr.tech/signup"><span>Sign Up</span></a> <span>|</span> <a href="https://a.tldrnewsletter.com/web-version?ep=1&amp;t=123"><span>View Online</span></a></div>
<h1><strong>Big Tech &amp; Startups</strong></h1>
<table align="center" border="0" width="100%"><tbody><tr><td style="padding:15px 15px">
<div><span><a href="https://links.tldrnewsletter.com/7UoBY5"><span><strong>The Identity Crisis at xAI (11 minute read)</strong></span></a><br><br><span style="font-family:Helvetica">One of xAI's goals is to catch up to Claude.</span></span></div>
</td></tr></tbody></table>
</td></tr></tbody></table>
</td></tr></tbody></table>
<img alt="" src="http://tracking.tldrnewsletter.com/CI0/pixel" style="display:none;width:1px;height:1px">
</div></div></div>`

describe('cleanEmailHtml', () => {
  const result = cleanEmailHtml(TLDR_HTML)

  it('removes the Gmail forward block but keeps the message', () => {
    expect(result.html).not.toContain('Forwarded message')
    expect(result.html).not.toContain('phareim@gmail.com')
    expect(result.html).toContain('The Identity Crisis at xAI')
    expect(result.html).toContain('Big Tech')
  })

  it('recovers the original sender as author', () => {
    expect(result.author).toBe('TLDR')
  })

  it('captures the hidden preheader as summary text, shed of padding', () => {
    expect(result.preheader).toBe(
      "One of SpaceXAI's goals is to get Grok to catch up to Anthropic's Claude"
    )
    // …and the hidden div itself is gone from the body.
    expect(result.html).not.toContain('max-height')
    expect(result.html).not.toMatch(/[‌​]/)
  })

  it('flattens layout tables and strips presentation attributes', () => {
    expect(result.html).not.toContain('<table')
    expect(result.html).not.toContain('style=')
    expect(result.html).not.toContain('align=')
    expect(result.html).not.toContain('class=')
    expect(result.html).toContain('href="https://links.tldrnewsletter.com/7UoBY5"')
  })

  it('removes link-pipe nav rows but keeps story links', () => {
    expect(result.html).not.toContain('Sign Up')
    expect(result.html).not.toContain('View Online')
    expect(result.html).toContain('The Identity Crisis at xAI')
  })

  it('drops the tracking pixel', () => {
    expect(result.html).not.toContain('tracking.tldrnewsletter.com')
    expect(result.html).not.toContain('<img')
  })

  it('keeps a genuine data table', () => {
    const { html } = cleanEmailHtml(
      '<p>Results:</p><table><tr><th>Model</th><th>Score</th></tr><tr><td>A</td><td>1</td></tr></table>'
    )
    expect(html).toContain('<table')
    expect(html).toContain('<th>Model</th>')
  })

  it('handles an Outlook-style header block', () => {
    const { html, author } = cleanEmailHtml(
      '<div><p>From: Money Stuff &lt;newsletter@bloomberg.net&gt;<br>Sent: Friday<br>To: me<br>Subject: The Index Fund</p><p>The actual body of the letter.</p></div>'
    )
    expect(html).not.toContain('Sent: Friday')
    expect(html).toContain('The actual body of the letter.')
    expect(author).toBe('Money Stuff')
  })

  it('fails soft: returns raw input when cleaning would empty the body', () => {
    const raw = '<div style="display:none">only hidden text here, nothing else at all</div>'
    expect(cleanEmailHtml(raw).html).toBe(raw)
  })

  it('keeps real images', () => {
    const { html } = cleanEmailHtml(
      '<p>hello</p><img src="https://images.example/photo.jpg" alt="a photo" width="600">'
    )
    expect(html).toContain('src="https://images.example/photo.jpg"')
    expect(html).not.toContain('width=')
  })
})

describe('viewInBrowserLink', () => {
  it('finds the newsletter\'s own View Online link by anchor text', () => {
    expect(viewInBrowserLink(TLDR_HTML)).toBe('https://a.tldrnewsletter.com/web-version?ep=1&t=123')
  })

  it('matches common phrasings', () => {
    expect(viewInBrowserLink('<a href="https://l.example/a">View this email in your browser</a>')).toBe('https://l.example/a')
    expect(viewInBrowserLink('<a href="https://l.example/b"><span>Web version</span></a>')).toBe('https://l.example/b')
  })

  it('returns null when no such link exists', () => {
    expect(viewInBrowserLink('<a href="https://l.example/c">Unsubscribe</a>')).toBeNull()
    expect(viewInBrowserLink(null)).toBeNull()
  })
})

describe('stripTextForwardHeader', () => {
  it('sheds the Gmail plain-text forward header', () => {
    const text = '---------- Forwarded message ---------\nFrom: TLDR <dan@tldrnewsletter.com>\nDate: Fri, Jul 17, 2026\nSubject: xAI chaos\nTo: <phareim@gmail.com>\n\nSign Up | View Online\nThe body starts here.'
    expect(stripTextForwardHeader(text)).toBe('Sign Up | View Online\nThe body starts here.')
  })

  it('leaves ordinary text untouched', () => {
    expect(stripTextForwardHeader('Dear reader,\nhello')).toBe('Dear reader,\nhello')
  })
})
