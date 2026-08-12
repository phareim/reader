import { parsePaletteQuery, filterCommands } from '~/utils/palette'

describe('parsePaletteQuery', () => {
  it('reads a leading > as command mode with the prefix stripped', () => {
    expect(parsePaletteQuery('>sync')).toEqual({ mode: 'commands', term: 'sync' })
    expect(parsePaletteQuery('> sync all')).toEqual({ mode: 'commands', term: 'sync all' })
  })

  it('a bare > browses the whole command list', () => {
    expect(parsePaletteQuery('>')).toEqual({ mode: 'commands', term: '' })
  })

  it('anything else is an article search, trimmed', () => {
    expect(parsePaletteQuery('  tufte  ')).toEqual({ mode: 'articles', term: 'tufte' })
    expect(parsePaletteQuery('')).toEqual({ mode: 'articles', term: '' })
  })

  it('a > later in the string does not switch modes', () => {
    expect(parsePaletteQuery('a > b')).toEqual({ mode: 'articles', term: 'a > b' })
  })
})

describe('filterCommands', () => {
  const commands = [
    { id: 'deck', label: 'Go to Deck' },
    { id: 'shelf', label: 'Go to Shelf' },
    { id: 'sync', label: 'Sync all feeds' },
  ]

  it('keeps everything on an empty term', () => {
    expect(filterCommands(commands, '')).toEqual(commands)
    expect(filterCommands(commands, '   ')).toEqual(commands)
  })

  it('matches case-insensitively on substrings', () => {
    expect(filterCommands(commands, 'SYNC')).toEqual([commands[2]])
    expect(filterCommands(commands, 'go')).toEqual([commands[0], commands[1]])
  })

  it('requires every token, in any order', () => {
    expect(filterCommands(commands, 'sh go')).toEqual([commands[1]])
    expect(filterCommands(commands, 'go feeds')).toEqual([])
  })
})
