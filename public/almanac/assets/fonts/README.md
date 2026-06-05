# Fonts

## Source Serif 4

The Almanac body face. Variable WOFF2 — one file covers weights 200–900.

- `source-serif-4-variable.woff2` — roman
- `source-serif-4-italic-variable.woff2` — italic
- `OFL.txt` — SIL Open Font License v1.1 (Adobe Originals)

Source: <https://github.com/adobe-fonts/source-serif>. Licensed under SIL OFL — free to ship in any project, commercial or otherwise. Keep `OFL.txt` alongside the WOFF2 files when you copy them into another project.

## Refreshing

```bash
curl -sSLfo source-serif-4-variable.woff2 \
  https://github.com/adobe-fonts/source-serif/raw/release/WOFF2/VAR/SourceSerif4Variable-Roman.ttf.woff2

curl -sSLfo source-serif-4-italic-variable.woff2 \
  https://github.com/adobe-fonts/source-serif/raw/release/WOFF2/VAR/SourceSerif4Variable-Italic.ttf.woff2

curl -sSLfo OFL.txt \
  https://raw.githubusercontent.com/adobe-fonts/source-serif/release/LICENSE.md
```

## Mono

No self-hosted mono. The Almanac uses tiny tracked uppercase MonoLabels only (9px), so the OS font stack is reliable across mediums:

```css
font-family: "SF Mono", ui-monospace, Menlo, Consolas, monospace;
```
