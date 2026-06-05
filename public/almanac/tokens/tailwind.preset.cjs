/* GENERATED FROM tokens/tokens.json — DO NOT HAND-EDIT.
   Run `node scripts/generate.mjs` to refresh. (Tailwind preset (CommonJS)) */

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
      },
      fontFamily: {
        'almanac-serif': ["Source Serif 4", "Georgia", "Iowan Old Style", "Charter", "serif"],
        'almanac-mono':  ["SF Mono", "ui-monospace", "Menlo", "Consolas", "monospace"],
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
      borderWidth: {
        'almanac-hairline': '1px',
      },
    },
  },
  darkMode: ['class', '[data-theme="dark"]'],
};
