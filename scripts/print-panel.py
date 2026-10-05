# Print file for the DJ booth panel: vector PDF in CMYK, straight from the logo outlines in public/brand/epping-logo.svg.
# Run: python3 scripts/print-panel.py  -> media/print/ (git-ignored)
# Panel 64 x 56 cm + 10 mm bleed on every side. Logo 58 cm wide with a 6% split (reads from the dancefloor), sitting above
# centre; @epping.music (left) and eppingmusic.com (right) under it in Unbounded 500, aligned to the logo's edges.
import json, re, subprocess

MM = 72 / 25.4
W, H, BLEED = 640, 560, 10            # finished size and bleed, mm
LOGO_W = 580                          # logo width, mm
SPLIT = 2.0                           # split relative to the site logo (3% -> 6%)
RAISE = 30                            # whole group sits this far above the panel centre, mm
TEXT_H, GAP = 22, 40                  # text height (cap/x-height box of the line) and gap under the logo, mm
# CMYK (0..1). Rich black for the big background; the logo colours as close as CMYK gets to Sunset rave.
CMYK = {
    'bg': (0.6, 0.4, 0.4, 1.0),       # rich black
    '#FFF4E8': (0, 0.04, 0.09, 0),    # cream
    '#FF4D00': (0, 0.75, 1.0, 0),     # orange
    '#FF2BD6': (0, 0.85, 0, 0),       # pink (neon pink can't be printed in CMYK: this is the closest magenta-pink)
}

svg = open('public/brand/epping-logo.svg').read()
vb = [float(v) for v in re.search(r'viewBox="([^"]+)"', svg).group(1).split()]
paths = re.findall(r'<path d="([^"]+)" fill="([^"]+)"(?: transform="translate\(([-\d.]+) ([-\d.]+)\)")?', svg)

# the two web lines as outlines (opentype.js via node; y down, size 100)
JS = r"""
const opentype = require('opentype.js'), fs = require('fs');
const b = fs.readFileSync('node_modules/@fontsource/unbounded/files/unbounded-latin-500-normal.woff');
const font = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
// glyph by glyph: font.getPath() gives NaN coordinates on this woff (unsupported GSUB lookup)
const line = (t) => { const p = new opentype.Path(); let x = 0;
  for (const ch of t) { const g = font.charToGlyph(ch); p.commands.push(...g.getPath(x, 0, 100).commands); x += font.getAdvanceWidth(ch, 100, { kerning: false }) + 2; }
  const n = (v) => { if (!Number.isFinite(v)) throw new Error('bad coordinate in ' + t); return +v.toFixed(3); };
  const d = p.commands.map((c) => c.type === 'Z' ? 'Z' : c.type === 'Q' ? `Q${n(c.x1)} ${n(c.y1)} ${n(c.x)} ${n(c.y)}`
    : c.type === 'C' ? `C${n(c.x1)} ${n(c.y1)} ${n(c.x2)} ${n(c.y2)} ${n(c.x)} ${n(c.y)}` : `${c.type}${n(c.x)} ${n(c.y)}`).join(' ');
  return { d, box: p.getBoundingBox() }; };
console.log(JSON.stringify(['@epping.music', 'eppingmusic.com'].map(line)));
"""
texts = json.loads(subprocess.run(['node', '-e', JS], capture_output=True, text=True, check=True).stdout)

PW, PH = (W + 2 * BLEED) * MM, (H + 2 * BLEED) * MM
f = lambda n: f'{n:.3f}'.rstrip('0').rstrip('.')
# logo glyph box (the paths without the split), in svg units
xs, ys = [], []
for d, *_ in paths:
    nums = [float(v) for v in re.findall(r'-?\d*\.?\d+', d)]
    xs += nums[0::2]; ys += nums[1::2]
gx0, gx1, gy0, gy1 = min(xs), max(xs), min(ys), max(ys)
k = LOGO_W * MM / (gx1 - gx0)                          # svg units -> pt, glyphs exactly LOGO_W wide
th = max(t['box']['y2'] - t['box']['y1'] for t in texts)
kt = TEXT_H * MM / th                                  # text units -> pt
group_h = (gy1 - gy0) * k + GAP * MM + TEXT_H * MM
top = PH / 2 + group_h / 2 + RAISE * MM                # pdf y of the logo's top edge
lx0 = (PW - LOGO_W * MM) / 2                           # logo's left edge, pt

def transform(sx, sy, ox, oy):  # svg (x, y down) -> pdf pt
    return lambda x, y: (ox + x * sx, oy - y * sy)

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

logo_pt = transform(k, k, lx0 - gx0 * k, top + gy0 * k)
ops = ['%s %s %s %s k' % CMYK['bg'], f'0 0 {f(PW)} {f(PH)} re f']
for d, fill, tx, ty in paths:  # back to front: orange, pink, cream (the edges never overlap outside the cream)
    ops += ['%s %s %s %s k' % CMYK[fill.upper()], pdf_path(d, float(tx or 0) * SPLIT, float(ty or 0) * SPLIT, logo_pt), 'f']
base = top - (gy1 - gy0) * k - GAP * MM               # pdf y of the text's top edge
for i, t in enumerate(texts):
    bx = t['box']; w = (bx['x2'] - bx['x1']) * kt
    x0 = lx0 if i == 0 else lx0 + LOGO_W * MM - w      # left line flush left, right line flush right
    ops += ['%s %s %s %s k' % CMYK['#FFF4E8'], pdf_path(t['d'], 0, 0, transform(kt, kt, x0 - bx['x1'] * kt, base + bx['y1'] * kt)), 'f']
content = '\n'.join(ops).encode()

b = BLEED * MM
objs = [
    b'<< /Type /Catalog /Pages 2 0 R >>',
    b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    (f'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {f(PW)} {f(PH)}] /BleedBox [0 0 {f(PW)} {f(PH)}] '
     f'/TrimBox [{f(b)} {f(b)} {f(PW - b)} {f(PH - b)}] /Contents 4 0 R /Resources << >> >>').encode(),
    b'<< /Length %d >>\nstream\n' % len(content) + content + b'\nendstream',
    b'<< /Title (EPPING DJ booth panel 64x56 cm, 10 mm bleed, CMYK) /Producer (scripts/print-panel.py) >>',
]
out = bytearray(b'%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'); offs = []
for i, o in enumerate(objs, 1):
    offs.append(len(out)); out += b'%d 0 obj\n' % i + o + b'\nendobj\n'
x = len(out)
out += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offs)
out += b'trailer\n<< /Size %d /Root 1 0 R /Info 5 0 R >>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, x)
name = 'media/print/epping-djbooth-64x56-afloop10mm-cmyk-v2.pdf'
open(name, 'wb').write(out)
print(name, f'{(W + 2 * BLEED)} x {(H + 2 * BLEED)} mm')
