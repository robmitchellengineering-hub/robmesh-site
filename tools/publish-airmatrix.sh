#!/usr/bin/env bash
# publish-airmatrix.sh - refresh the public AirMatrix page from the private repo, keeping the
# ROB protocol link.
#
# The page is generated in the private airmatrix repo (scripts/today.py -> airmatrix-today.html)
# and published here as a copy, so the page is public while the repository stays private. A plain
# copy would silently drop any link added to the published copy, which is exactly what happened
# on 2026-10-23 (Rob: "there is no link to the rob protocol in the airmatrix page"). So the copy
# and the link injection are one step, and the injection is idempotent.
#
# usage: tools/publish-airmatrix.sh [source-html]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="${1:-$HOME/code/airmatrix/airmatrix-today.html}"
DST="$REPO_ROOT/airmatrix/index.html"
URL="https://robmitchellengineering-hub.github.io/rob-protocol/"

[ -f "$SRC" ] || { echo "no source page at $SRC" >&2; exit 2; }
mkdir -p "$(dirname "$DST")"
cp "$SRC" "$DST"

python3 - "$DST" "$URL" <<'PY'
import sys
path, url = sys.argv[1], sys.argv[2]
s = open(path).read()
link = ('  <p class="sub">Transport: <a href="' + url + '" target="_blank" rel="noopener">'
        'ROB — Robust Object Broadcast</a> — the protocol this runs over, as an animated '
        'explainer.</p>\n')
marker = '  <h2>Every feature, live'
if marker in s and 'ROB — Robust Object Broadcast' not in s:
    s = s.replace(marker, link + marker, 1)
foot = 'main <code>'
if 'transport: <a href="' + url in s:
    pass
elif '.</div>' in s and foot in s:
    i = s.rindex('.</div>', 0, s.index('</body>'))
    s = s[:i] + ' · transport: <a href="' + url + '" target="_blank" rel="noopener">ROB protocol</a>' + s[i:]
open(path, 'w').write(s)
print('published with ROB protocol link:', s.count(url), 'reference(s)')
PY

echo "wrote $DST ($(wc -c < "$DST" | tr -d ' ') bytes)"
