/**
 * Pure logic for the command palette (CommandPalette.vue, ⌘/Ctrl+Shift+P).
 *
 * One input, two modes: a leading `>` searches commands (the VS Code
 * convention), anything else searches articles. The component owns fetch,
 * focus, and navigation; this file owns how a query is read and how the
 * command list is narrowed.
 */

export interface PaletteQuery {
  mode: 'commands' | 'articles'
  /** The query with the `>` prefix (and padding) stripped. */
  term: string
}

export function parsePaletteQuery(raw: string): PaletteQuery {
  if (raw.startsWith('>')) {
    return { mode: 'commands', term: raw.slice(1).trim() }
  }
  return { mode: 'articles', term: raw.trim() }
}

export interface PaletteCommand {
  id: string
  label: string
}

/**
 * Case-insensitive word filter: every whitespace-separated token of the term
 * must appear somewhere in the label, so "go sh" finds "Go to Shelf" and
 * token order doesn't matter. An empty term keeps the whole list — `>` alone
 * is a browse.
 */
export function filterCommands<T extends PaletteCommand>(commands: T[], term: string): T[] {
  const tokens = term.toLowerCase().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return commands
  return commands.filter((cmd) => {
    const label = cmd.label.toLowerCase()
    return tokens.every((t) => label.includes(t))
  })
}
