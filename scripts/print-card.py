# Print file for the business card (design A front + A2b back): vector PDF in CMYK, 2 pages (front, back).
# Run: python3 scripts/print-card.py  -> media EPPING website/print/ (git-ignored)
# Card 85 x 55 mm + 3 mm bleed = 91 x 61 mm page, no crop marks. Everything is outlines (no fonts embedded).
# Front: just the site logo, centred. Back: four rows of icon tile (pink outline) + contact line in Archivo 600.
# Needs the Archivo 600 woff in media EPPING website/print/fonts/ (from @fontsource/archivo).
import json, math, re, subprocess

MM = 72 / 25.4
W, H, BLEED = 85, 55, 3               # finished size and bleed, mm
LOGO_W = 60                           # front logo width, mm
# back, mm (= the A2b mockup at 10 px per mm)
PAD_X, TILE, RADIUS, BORDER = 9, 5.8, 1.4, 0.2
ICON, ICON_STROKE = 3.0, 0.225        # icon box and stroke, mm (24-unit icons, stroke 1.8)
TEXT_GAP, TEXT_SIZE, ROW_GAP = 2.4, 3.1, 1.8
FONT = 'media EPPING website/print/fonts/archivo-latin-600-normal.woff'
CMYK = {
    'bg': (0.6, 0.4, 0.4, 1.0),       # rich black
    '#FFF4E8': (0, 0.04, 0.09, 0),    # cream
    '#FF4D00': (0, 0.75, 1.0, 0),     # orange
    '#FF2BD6': (0, 0.85, 0, 0),       # pink (closest printable magenta-pink)
}
LINES = ['@epping.music', '+31 6 4018 7865', 'bookings@eppingmusic.com', 'eppingmusic.com']

# 24-unit stroke icons, same as the mockup: ('rect', x, y, w, h, r) | ('circle', cx, cy, r) | ('path', svg d, absolute M/L/C)
ICONS = [
    [('rect', 3, 3, 18, 18, 5), ('circle', 12, 12, 4), ('circle', 17.5, 6.5, 0.8)],
    [('rect', 6, 2, 12, 20, 2.5), ('path', 'M11 18 L13 18')],
    [('rect', 3, 5, 18, 14, 2), ('path', 'M3 7 L12 13 L21 7')],
    [('circle', 12, 12, 9), ('path', 'M3 12 L21 12'), ('path', 'M12 3 C15 6.5 15 17.5 12 21'), ('path', 'M12 3 C9 6.5 9 17.5 12 21')],
]

JS = r"""
const opentype = require('opentype.js'), fs = require('fs');
const b = fs.readFileSync(process.argv[1]);
const font = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
// glyph by glyph (font.getPath() can trip on GSUB lookups), with pair kerning where the font has it
const line = (t) => { const p = new opentype.Path(); let x = 0, prev = null;
  for (const ch of t) { const g = font.charToGlyph(ch);
    if (prev) { try { x += font.getKerningValue(prev, g) * 100 / font.unitsPerEm; } catch (e) {} }
    p.commands.push(...g.getPath(x, 0, 100).commands); x += g.advanceWidth * 100 / font.unitsPerEm; prev = g; }
  const n = (v) => { if (!Number.isFinite(v)) throw new Error('bad coordinate in ' + t); return +v.toFixed(3); };
  const d = p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
    : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join(' ');
  return { d }; };
console.log(JSON.stringify({ cap: font.tables.os2.sCapHeight * 100 / font.unitsPerEm, lines: JSON.parse(process.argv[2]).map(line) }));
"""
fnt = json.loads(subprocess.run(['node', '-e', JS, FONT, json.dumps(LINES)], capture_output=True, text=True, check=True).stdout)

PW, PH = (W + 2 * BLEED) * MM, (H + 2 * BLEED) * MM
f = lambda n: f'{n:.3f}'.rstrip('0').rstrip('.')
fill = lambda c: '%s %s %s %s k' % CMYK[c]
stroke = lambda c: '%s %s %s %s K' % CMYK[c]
card = lambda x, y: ((BLEED + x) * MM, PH - (BLEED + y) * MM)   # card mm (y down, from the trim corner) -> pdf pt

def pdf_path(d, tx, ty, pt):
    out, cur, start = [], (0, 0), (0, 0)
    for cmd, args in re.findall(r'([MLQCZ])([^MLQCZ]*)', d):
        n = [float(v) for v in re.findall(r'-?\d*\.?\d+(?:e-?\d+)?', args)]
        n = [v + (ty if i % 2 else tx) for i, v in enumerate(n)]
        if cmd == 'M': cur = start = (n[0], n[1]); out.append('%s %s m' % tuple(map(f, pt(*cur))))
        elif cmd == 'L': cur = (n[0], n[1]); out.append('%s %s l' % tuple(map(f, pt(*cur))))
        elif cmd == 'Q':  # quadratic -> cubic
            (x0, y0), (qx, qy), (x, y) = cur, (n[0], n[1]), (n[2], n[3])
            c1 = (x0 + 2 / 3 * (qx - x0), y0 + 2 / 3 * (qy - y0)); c2 = (x + 2 / 3 * (qx - x), y + 2 / 3 * (qy - y))
            out.append(' '.join(f(v) for p in (c1, c2, (x, y)) for v in pt(*p)) + ' c'); cur = (x, y)
        elif cmd == 'C':
            out.append(' '.join(f(v) for i in range(0, 6, 2) for v in pt(n[i], n[i + 1])) + ' c'); cur = (n[4], n[5])
        else: out.append('h'); cur = start
    return '\n'.join(out)

K = 0.5523
def rrect(x, y, w, h, r):  # rounded rect as svg d (y down)
    return (f'M{x + r} {y} L{x + w - r} {y} C{x + w - r + K * r} {y} {x + w} {y + r - K * r} {x + w} {y + r} '
            f'L{x + w} {y + h - r} C{x + w} {y + h - r + K * r} {x + w - r + K * r} {y + h} {x + w - r} {y + h} '
            f'L{x + r} {y + h} C{x + r - K * r} {y + h} {x} {y + h - r + K * r} {x} {y + h - r} '
            f'L{x} {y + r} C{x} {y + r - K * r} {x + r - K * r} {y} {x + r} {y} Z')
def circle(cx, cy, r):
    return (f'M{cx + r} {cy} C{cx + r} {cy + K * r} {cx + K * r} {cy + r} {cx} {cy + r} C{cx - K * r} {cy + r} {cx - r} {cy + K * r} {cx - r} {cy} '
            f'C{cx - r} {cy - K * r} {cx - K * r} {cy - r} {cx} {cy - r} C{cx + K * r} {cy - r} {cx + r} {cy - K * r} {cx + r} {cy} Z')

def mm_pt(ox, oy, s):  # local units (y down) -> pdf pt, origin at card mm (ox, oy), s mm per unit
    return lambda x, y: card(ox + x * s, oy + y * s)

background = [fill('bg'), f'0 0 {f(PW)} {f(PH)} re f']

# front: the site logo (outlines from public/brand/epping-logo.svg), glyphs LOGO_W wide, centred on the card
svg = open('public/brand/epping-logo.svg').read()
paths = re.findall(r'<path d="([^"]+)" fill="([^"]+)"(?: transform="translate\(([-\d.]+) ([-\d.]+)\)")?', svg)
xs, ys = [], []
for d, *_ in paths:
    nums = [float(v) for v in re.findall(r'-?\d*\.?\d+', d)]
    xs += nums[0::2]; ys += nums[1::2]
gx0, gx1, gy0, gy1 = min(xs), max(xs), min(ys), max(ys)
s = LOGO_W / (gx1 - gx0)
logo = mm_pt((W - LOGO_W) / 2 - gx0 * s, (H - (gy1 - gy0) * s) / 2 - gy0 * s, s)
front = list(background)
for d, c, tx, ty in paths:  # orange, pink split first, cream letters last (on top)
    front += [fill(c.upper()), pdf_path(d, float(tx or 0), float(ty or 0), logo), 'f']

# back: icon tiles + lines, the block centred vertically
back = list(background) + ['1 J 1 j']
top = (H - (4 * TILE + 3 * ROW_GAP)) / 2
ts = TEXT_SIZE / 100
for i, (icon, t) in enumerate(zip(ICONS, fnt['lines'])):
    y = top + i * (TILE + ROW_GAP)
    inset = BORDER / 2   # css border sits inside the tile: stroke along the middle of it
    back += [stroke('#FF2BD6'), f'{f(BORDER * MM)} w', pdf_path(rrect(PAD_X + inset, y + inset, TILE - BORDER, TILE - BORDER, RADIUS - inset), 0, 0, card), 'S']
    u = ICON / 24
    pt = mm_pt(PAD_X + (TILE - ICON) / 2, y + (TILE - ICON) / 2, u)
    back.append(f'{f(ICON_STROKE * MM)} w')
    for shape, *a in icon:
        d = rrect(*a) if shape == 'rect' else circle(*a) if shape == 'circle' else a[0]
        back += [pdf_path(d, 0, 0, pt), 'S']
    base = y + TILE / 2 + fnt['cap'] * ts / 2   # baseline: cap height centred on the tile
    back += [fill('#FFF4E8'), pdf_path(t['d'], 0, 0, mm_pt(PAD_X + TILE + TEXT_GAP, base, ts)), 'f']

b = BLEED * MM
pages = [('\n'.join(front)).encode(), ('\n'.join(back)).encode()]
objs = [b'<< /Type /Catalog /Pages 2 0 R >>', b'<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>']
for i, content in enumerate(pages):
    objs += [(f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {f(PW)} {f(PH)}] /BleedBox [0 0 {f(PW)} {f(PH)}] '
              f'/TrimBox [{f(b)} {f(b)} {f(PW - b)} {f(PH - b)}] /Contents {len(objs) + 2} 0 R /Resources << >> >>').encode(),
             b'<< /Length %d >>\nstream\n' % len(content) + content + b'\nendstream']
objs.append(b'<< /Title (EPPING business card 85x55 mm, 3 mm bleed, CMYK) /Producer (scripts/print-card.py) >>')
out = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'); offs = []
for i, o in enumerate(objs, 1):
    offs.append(len(out)); out += b'%d 0 obj\n' % i + o + b'\nendobj\n'
x = len(out)
out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offs)
out += b'trailer\n<< /Size %d /Root 1 0 R /Info %d 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, len(objs), x)
name = 'media EPPING website/print/epping-visitekaartje-91x61-afloop3mm-cmyk.pdf'
open(name, 'wb').write(out)
print(name, f'{W + 2 * BLEED} x {H + 2 * BLEED} mm, 2 pages')
