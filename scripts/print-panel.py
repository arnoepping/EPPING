# Print file for the DJ booth panel: vector PDF in CMYK, straight from the logo outlines in public/brand/epping-logo.svg.
# Run: python3 scripts/print-panel.py  -> media/print/ (git-ignored)
# Panel 64 x 56 cm + 10 mm bleed on every side; logo 54 cm wide, centred (well inside the 10 mm safe zone).
import re

MM = 72 / 25.4
W, H, BLEED = 640, 560, 10            # finished size and bleed, mm
LOGO_W = 540                          # logo width, mm
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

PW, PH = (W + 2 * BLEED) * MM, (H + 2 * BLEED) * MM
k = LOGO_W * MM / vb[2]                               # svg units -> pt
ox = (PW - vb[2] * k) / 2 - vb[0] * k
oy = (PH - vb[3] * k) / 2 + (vb[1] + vb[3]) * k       # flip y: svg y down, pdf y up
pt = lambda x, y: (ox + x * k, oy - y * k)
f = lambda n: f'{n:.3f}'.rstrip('0').rstrip('.')

def pdf_path(d, tx, ty):
    out, cur, start = [], (0, 0), (0, 0)
    for cmd, args in re.findall(r'([MLQCZ])([^MLQCZ]*)', d):
        n = [float(v) for v in re.findall(r'-?\d*\.?\d+', args)]
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

ops = ['%s %s %s %s k' % CMYK['bg'], f'0 0 {f(PW)} {f(PH)} re f']
for d, fill, tx, ty in paths:  # back to front: orange, pink, cream (same look as the screen blend: the edges never overlap outside the cream)
    ops += ['%s %s %s %s k' % CMYK[fill.upper()], pdf_path(d, float(tx or 0), float(ty or 0)), 'f']
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
name = 'media/print/epping-djbooth-64x56-afloop10mm-cmyk.pdf'
open(name, 'wb').write(out)
print(name, f'{(W + 2 * BLEED)} x {(H + 2 * BLEED)} mm')
