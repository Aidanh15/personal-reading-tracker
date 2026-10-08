#!/bin/bash
# Pull clippings.io Auto Export Markdown files (one per book) from a public
# Google Drive folder into imports/clippings/ (bind-mounted into the live
# container as /app/imports), then ask the app to import any new highlights
# right away instead of waiting for its own daily check.
# Run daily by scripts/systemd/clippings-sync.timer.
#
#   scripts/sync-clippings.sh             # sync + import
#   scripts/sync-clippings.sh --no-import # sync only
#
# The folder is shared as "anyone with the link", so no Google login is needed.
# Its ID is kept out of the repo: put CLIPPINGS_FOLDER_ID=<id> in .env.clippings
# (gitignored) in the project directory.
# A file is only rewritten when its content changed, so the app (which skips
# files whose size and mtime are unchanged) only re-reads books with new highlights.
set -euo pipefail

PROJECT_DIR=/mnt/SSD/projects/personal-reading-tracker
ENV_FILE="$PROJECT_DIR/.env.clippings"
[ -f "$ENV_FILE" ] && . "$ENV_FILE"
FOLDER_ID="${CLIPPINGS_FOLDER_ID:?Set CLIPPINGS_FOLDER_ID in $ENV_FILE}"
DEST="${CLIPPINGS_DEST:-$PROJECT_DIR/imports/clippings}"
APP_URL=http://100.125.191.12:3004

mkdir -p "$DEST"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

curl -fsSL "https://drive.google.com/embeddedfolderview?id=$FOLDER_ID" -o "$TMP/folder.html"

# One "<file id>\t<file name>" line per Markdown file in the folder
python3 -I -c '
import html, re, sys
page = open(sys.argv[1], encoding="utf-8").read()
for file_id, name in re.findall(r"id=\"entry-([\w-]+)\".*?flip-entry-title\">([^<]*)<", page, re.S):
    name = html.unescape(name).replace("/", "-").strip()
    if name.lower().endswith((".md", ".markdown")):
        print(f"{file_id}\t{name}")
' "$TMP/folder.html" > "$TMP/files.tsv"

listed=0 changed=0
while IFS=$'\t' read -r id name; do
  listed=$((listed + 1))
  curl -fsSL "https://drive.google.com/uc?export=download&id=$id" -o "$TMP/file"
  if ! cmp -s "$TMP/file" "$DEST/$name"; then
    cp "$TMP/file" "$DEST/$name"
    changed=$((changed + 1))
    echo "Updated: $name"
  fi
done < "$TMP/files.tsv"
echo "$listed Markdown files in the Drive folder, $changed new or changed"

if [ "$listed" -eq 0 ]; then
  echo "Warning: no Markdown files found; is the folder still shared publicly?" >&2
fi

if [ "${1:-}" != "--no-import" ] && [ "$changed" -gt 0 ]; then
  curl -fsS -X POST "$APP_URL/api/sync/clippings"
  echo
fi
