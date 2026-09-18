#!/bin/sh
# Submit cmdxray's Pages URLs to IndexNow (Bing/Yandex/Seznam) — legitimate,
# no-account, non-spam search-engine notification. Re-run after shipping new pages.
set -e
KEY=$(cat "$(dirname "$0")/../docs/"*.txt 2>/dev/null | grep -E '^[0-9a-f]{32}$' | head -1)
BASE="https://aurelio-nakamura.github.io/cmdxray"
HOST="aurelio-nakamura.github.io"
URLS=$(curl -s "$BASE/sitemap.xml" | grep -oE '<loc>[^<]+</loc>' | sed 's/<[^>]*>//g')
JSON=$(printf '%s\n' "$URLS" | python3 -c "import sys,json;host='$HOST';key='$KEY';loc='$BASE/'+key+'.txt';urls=[l.strip() for l in sys.stdin if l.strip()];print(json.dumps({'host':host,'key':key,'keyLocation':loc,'urlList':urls}))")
echo "Submitting $(printf '%s\n' "$URLS" | grep -c . ) URLs to IndexNow..."
curl -s -w '\nHTTP %{http_code}\n' -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" -d "$JSON"
