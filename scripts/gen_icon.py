#!/usr/bin/env python3
"""Generate Reader app icons: ET Book R above rust rule on aged paper.

Forked from the Write/Do family (write/Write/scripts/gen_icon.py) so the
Reader icon sits in the same set as Do (D), Write (W), and Sleep (moon).
Differences: glyph "R", the family's American Typewriter is replaced by the
Reader's own vendored ET Book bold (public/tufte/fonts/), and the outputs are
the web/PWA icon files under public/ instead of an Xcode appiconset.

Requires Pillow + fontTools (PIL can't read woff, so the vendored font is
converted to a temp ttf first):

    python3 -m venv /tmp/reader-icon-venv
    /tmp/reader-icon-venv/bin/pip install pillow fonttools
    /tmp/reader-icon-venv/bin/python scripts/gen_icon.py
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter
from fontTools.ttLib import TTFont
import random, os, math, tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.normpath(os.path.join(HERE, "..", "public"))
FONT_WOFF = os.path.join(PUBLIC, "tufte", "fonts", "et-book-bold.woff")
S = 1024  # master size

# Family palette (identical to Write/Do)
PAPER = (244, 240, 232)
INK   = (26, 26, 26)
RUST  = (193, 74, 42)


def load_font(target_h):
    woff = TTFont(FONT_WOFF)
    woff.flavor = None  # decompress to plain sfnt/ttf
    tmp = tempfile.NamedTemporaryFile(suffix=".ttf", delete=False)
    woff.save(tmp.name)
    return ImageFont.truetype(tmp.name, target_h)


def make_paper(size):
    img = Image.new("RGB", (size, size), PAPER)
    px = img.load()
    rnd = random.Random(7)
    for y in range(size):
        for x in range(size):
            n = rnd.randint(-7, 5)
            r, g, b = px[x, y]
            px[x, y] = (max(0, min(255, r + n)),
                        max(0, min(255, g + n)),
                        max(0, min(255, g + n - 2)))
    vignette = Image.new("L", (size, size), 0)
    vd = ImageDraw.Draw(vignette)
    cx, cy = size / 2, size / 2
    maxd = math.hypot(cx, cy)
    for y in range(0, size, 2):
        for x in range(0, size, 2):
            d = math.hypot(x - cx, y - cy) / maxd
            v = int(max(0, (d - 0.55)) * 230)
            vd.point((x, y), fill=min(255, v))
    vignette = vignette.filter(ImageFilter.GaussianBlur(20))
    dark = Image.new("RGB", (size, size), (120, 95, 55))
    img = Image.composite(dark, img, vignette)

    spd = ImageDraw.Draw(img)
    for _ in range(80):
        x = rnd.randint(0, size - 1); y = rnd.randint(0, size - 1)
        r = rnd.randint(1, 3)
        spd.ellipse((x - r, y - r, x + r, y + r),
                    fill=(150 + rnd.randint(-20, 10), 120, 80))
    return img.filter(ImageFilter.GaussianBlur(0.4))


def draw_glyph(img, size):
    d = ImageDraw.Draw(img)
    font = load_font(int(size * 0.46))
    text = "R"
    bbox = d.textbbox((0, 0), text, font=font)
    tw = bbox[2] - bbox[0]
    th = bbox[3] - bbox[1]
    x = (size - tw) / 2 - bbox[0]
    y = (size - th) / 2 - bbox[1]
    rule_y = int(y + bbox[3] + size * 0.04)

    d.text((x + 2, y + 3), text, font=font, fill=(0, 0, 0, 80))
    d.text((x, y), text, font=font, fill=INK)
    d.text((x + 1, y), text, font=font, fill=(40, 30, 25))
    return rule_y


def draw_rule(img, size, rule_y):
    d = ImageDraw.Draw(img)
    rule_w = int(size * 0.34)
    x0 = (size - rule_w) // 2
    x1 = x0 + rule_w
    thickness = max(6, size // 110)
    d.rectangle((x0, rule_y, x1, rule_y + thickness), fill=RUST)
    cap = thickness * 2
    d.ellipse((x0 - cap // 2, rule_y + thickness // 2 - cap // 2,
               x0 + cap // 2, rule_y + thickness // 2 + cap // 2), fill=RUST)
    d.ellipse((x1 - cap // 2, rule_y + thickness // 2 - cap // 2,
               x1 + cap // 2, rule_y + thickness // 2 + cap // 2), fill=RUST)

    rule2_y = rule_y + int(size * 0.045)
    r2w = int(rule_w * 0.55)
    rx0 = (size - r2w) // 2
    t2 = max(2, thickness // 3)
    d.rectangle((rx0, rule2_y, rx0 + r2w, rule2_y + t2), fill=RUST)


master = make_paper(S)
rule_y = draw_glyph(master, S)
draw_rule(master, S, rule_y)

# Full-bleed opaque squares — iOS and the PWA manifest mask corners
# themselves, and 'maskable' needs the artwork inside the centre safe zone
# (the glyph sits well within it).
OUTPUTS = [
    ("pwa-512x512.png", 512),
    ("pwa-192x192.png", 192),
    ("apple-touch-icon.png", 180),
    ("favicon.png", 64),
]
for name, sz in OUTPUTS:
    master.resize((sz, sz), Image.LANCZOS).save(os.path.join(PUBLIC, name), "PNG")
    print("wrote", name, sz)

master.save("/tmp/reader_icon_preview.png")
print("preview /tmp/reader_icon_preview.png")
