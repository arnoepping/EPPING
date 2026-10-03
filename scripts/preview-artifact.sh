#!/bin/sh
# Build the site and make a relative-path copy in media/preview-3d/ (git-ignored) for the private claude.ai preview.
# The preview host reserves names starting with "_", so _astro becomes assets.
set -e
npm run build
rm -rf media/preview-3d && mkdir -p media/preview-3d
cp -R dist/_astro media/preview-3d/assets && cp -R dist/media dist/posters dist/favicon.svg media/preview-3d/
python3 - <<'PY'
import re
h = open('dist/index.html').read().replace('"/_astro/', '"assets/').replace('href="/favicon.svg"', 'href="favicon.svg"')
head = re.search(r'<head>(.*?)</head>', h, re.S).group(1)
head = re.sub(r'<meta (charset|name="viewport")[^>]*>', '', head)
body = re.search(r'<body[^>]*>(.*)</body>', h, re.S).group(1)
open('media/preview-3d/index.html', 'w').write(head.strip() + '\n' + body.strip() + '\n')
PY
echo "preview ready in media/preview-3d/"
