/* Almanac Tailwind preset — repo-local copy.
   Base palette/type generated from tokens/tokens.json, extended with the
   semantic, theme-aware utility names the Reader app uses everywhere:
     bg-paper, text-ink, text-mute, text-rust, border-rule, font-serif.

   The semantic colors map to CSS custom properties (from
   public/almanac/tokens/tokens.css), so one set of class names resolves to
   the light OR dark palette automatically under
   @media (prefers-color-scheme: dark). */

module.exports = {
  theme: {
    extend: {
      colors: {
        almanac: {
          paper:  '#f4f0e8',
          ink:    '#1a1a1a',
          mute:   '#6a6a6a',
          rust:   '#c14a2a',
          rule:   '#d8d2c4',
          'night-top':    '#161b24',
          'night-bottom': '#0e1219',
          'night-ink':    '#ebe4d4',
          'night-mute':   '#7a8a9a',
          amber:          '#d4a574',
        },

        // Semantic, theme-aware tokens. Resolve to CSS variables that flip
        // between light/dark via tokens.css. Use these everywhere.
        paper:  'var(--almanac-bg)',
        ink:    'var(--almanac-fg)',
        mute:   'var(--almanac-fg-mute)',
        rust:   'var(--almanac-accent)',
        rule:   'var(--almanac-rule-line)',
        'header-rule': 'var(--almanac-header-rule)',
      },
      fontFamily: {
        'almanac-serif': ["Source Serif 4", "Georgia", "Iowan Old Style", "Charter", "serif"],
        'almanac-mono':  ["SF Mono", "ui-monospace", "Menlo", "Consolas", "monospace"],
        // `font-serif` is the canonical body face for the whole app.
        'serif': ["Source Serif 4", "Georgia", "Iowan Old Style", "Charter", "serif"],
        'mono':  ["SF Mono", "ui-monospace", "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        'almanac-headline':  ['26px',  { lineHeight: '1.2', letterSpacing: '-0.012em' }],
        'almanac-body':      ['14px',      { lineHeight: '1.55' }],
        'almanac-italic':    ['13px',    { lineHeight: '1.55', fontStyle: 'italic' }],
        'almanac-monolabel': ['9px', { letterSpacing: '0.16em' }],
      },
      spacing: {
        'almanac-gutter':      '22px',
        'almanac-section-gap': '14px',
      },
      maxWidth: {
        'almanac-measure': '65ch',
      },
      borderColor: {
        rule: 'var(--almanac-rule-line)',
        'header-rule': 'var(--almanac-header-rule)',
      },
      borderWidth: {
        'almanac-hairline': '1px',
      },
    },
  },
  // System-preference dark mode. The vendored tokens.css drives the actual
  // palette flip under @media (prefers-color-scheme: dark).
  darkMode: 'media',
};
