#!/bin/sh
# Build the site and make a relative-path copy in media/preview-3d/ (git-ignored) for the private claude.ai preview.
# The preview host reserves names starting with "_", so _astro becomes assets.
set -e
npm run build
rm -rf media/preview-3d && mkdir -p media/preview-3d
cp -R dist/_astro media/preview-3d/assets && cp -R dist/media dist/posters dist/models dist/draco dist/favicon.svg media/preview-3d/
python3 - <<'PY'
import re
h = open('dist/index.html').read().replace('"/_astro/', '"assets/').replace('href="/favicon.svg"', 'href="favicon.svg"')
head = re.search(r'<head>(.*?)</head>', h, re.S).group(1)
head = re.sub(r'<meta (charset|name="viewport")[^>]*>', '', head)
body = re.search(r'<body[^>]*>(.*)</body>', h, re.S).group(1)
open('media/preview-3d/index.html', 'w').write(head.strip() + '\n' + body.strip() + '\n')
PY
# the preview host doesn't serve .glb (nor binary in text files): put the model inline in the page as base64
python3 - <<'PY2'
import base64
b64 = base64.b64encode(open('media/preview-3d/models/street.glb', 'rb').read()).decode()
p = 'media/preview-3d/index.html'; h = open(p).read()
open(p, 'w').write('<script>window.__STREET_GLB__=Uint8Array.from(atob("' + b64 + '"),c=>c.charCodeAt(0)).buffer;</script>\n' + h)
PY2
rm media/preview-3d/models/street.glb
# the preview host allows 16 MB per file: a 64 kbps copy of the mix
ffmpeg -loglevel error -y -i public/media/ade-house-mix.mp3 -c:a libmp3lame -b:a 64k media/preview-3d/media/ade-house-mix.mp3
echo "preview ready in media/preview-3d/"
