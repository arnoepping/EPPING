#!/bin/sh
# Build the site and make a relative-path copy in media/preview-3d/ (git-ignored) for the private claude.ai preview.
# The preview host reserves names starting with "_", so _astro becomes assets.
set -e
OUT="${1:-media/preview-3d}"   # a second folder (e.g. media/preview-bake) gives a separate preview page
export OUT
npm run build
rm -rf "$OUT" && mkdir -p "$OUT"
cp -R dist/_astro "$OUT/assets" && cp -R dist/media dist/posters dist/models dist/draco dist/favicon.svg "$OUT/"
python3 - <<'PY'
import os, re
h = open('dist/index.html').read().replace('"/_astro/', '"assets/').replace('href="/favicon.svg"', 'href="favicon.svg"')
head = re.search(r'<head>(.*?)</head>', h, re.S).group(1)
head = re.sub(r'<meta (charset|name="viewport")[^>]*>', '', head)
body = re.search(r'<body[^>]*>(.*)</body>', h, re.S).group(1)
open(os.environ['OUT'] + '/index.html', 'w').write(head.strip() + '\n' + body.strip() + '\n')
PY
# the preview host doesn't serve .glb (nor binary in text files): put the model inline in the page as base64
python3 - <<'PY2'
import base64
import os
p = os.environ['OUT'] + '/index.html'; h = open(p).read()
for var, f in [('__STREET_GLB__', 'street.glb'), ('__STAIR_GLB__', 'stairwell.glb'), ('__ROOF_GLB__', 'roof.glb')]:
    path = os.environ['OUT'] + '/models/' + f
    if not os.path.exists(path): continue
    b64 = base64.b64encode(open(path, 'rb').read()).decode()
    h = '<script>window.' + var + '=Uint8Array.from(atob("' + b64 + '"),c=>c.charCodeAt(0)).buffer;</script>\n' + h
    os.remove(path)
open(p, 'w').write(h)
PY2
# font lab: a small switcher to compare type pairings (preview only, never on the site)
cp scripts/fontlab.js "$OUT/fontlab.js" && printf '<script src="fontlab.js"></script>\n' >> "$OUT/index.html"
# gallery lab: switcher for the gallery/lightbox styles (preview only)
cp scripts/gallerylab.js "$OUT/gallerylab.js" && printf '<script src="gallerylab.js"></script>\n' >> "$OUT/index.html"
# the preview host allows 16 MB per file: a 64 kbps copy of the mix
ffmpeg -loglevel error -y -i public/media/ade-house-mix.mp3 -c:a libmp3lame -b:a 64k "$OUT/media/ade-house-mix.mp3"
echo "preview ready in $OUT/"
