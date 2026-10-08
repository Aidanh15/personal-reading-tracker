#!/bin/bash
# Run a built image as a preview at http://100.125.191.12:3005, on a snapshot of
# the live library. Nothing is shared with the live site: the preview gets its
# own copy of the database and covers in preview-data/ (gitignored).
#
#   scripts/preview.sh start [image]   # default image: personal-reading-tracker:<HEAD sha>
#   scripts/preview.sh start [image] --keep-data   # reuse the existing preview copy
#   scripts/preview.sh stop
#
# Promote a previewed image without rebuilding: IMAGE=<image> scripts/redeploy.sh
set -euo pipefail

PROJECT_DIR=/mnt/SSD/projects/personal-reading-tracker
PREVIEW_DIR="$PROJECT_DIR/preview-data"
LIVE_CONTAINER=reading-tracker-ui-test
CONTAINER=reading-tracker-preview
HOST_BIND=100.125.191.12
HOST_PORT=3005

cd "$PROJECT_DIR"

case "${1:-}" in
  stop)
    docker rm -f "$CONTAINER" >/dev/null 2>&1 && echo "Preview stopped" || echo "No preview running"
    exit 0
    ;;
  start) ;;
  *) echo "Usage: $0 start [image] [--keep-data] | stop" >&2; exit 1 ;;
esac

IMAGE="personal-reading-tracker:$(git rev-parse --short HEAD)"
KEEP_DATA=0
for arg in "${@:2}"; do
  if [ "$arg" = "--keep-data" ]; then KEEP_DATA=1; else IMAGE="$arg"; fi
done

docker image inspect "$IMAGE" >/dev/null || { echo "Image $IMAGE not found; build it first" >&2; exit 1; }
docker rm -f "$CONTAINER" >/dev/null 2>&1 || true

if [ "$KEEP_DATA" = 0 ]; then
  echo "==> Snapshotting the live library into preview-data/"
  rm -rf "$PREVIEW_DIR"
  mkdir -p "$PREVIEW_DIR/data" "$PREVIEW_DIR/logs" "$PREVIEW_DIR/backups"
  # SQLite's online backup gives a consistent copy while the live app keeps running
  docker exec -i "$LIVE_CONTAINER" node - <<'EOF'
const Database = require('/app/backend/node_modules/better-sqlite3');
new Database('/app/data/reading-tracker.db', { readonly: true }).backup('/app/tmp/preview-snapshot.db');
EOF
  docker cp "$LIVE_CONTAINER:/app/tmp/preview-snapshot.db" "$PREVIEW_DIR/data/reading-tracker.db"
  docker exec "$LIVE_CONTAINER" rm -f /app/tmp/preview-snapshot.db
  # No -p: the SSD is NTFS and refuses permission changes
  cp -r data/covers "$PREVIEW_DIR/data/"
fi

echo "==> Starting $IMAGE as the preview"
docker run -d --name "$CONTAINER" \
  --security-opt no-new-privileges:true \
  --memory 512m --cpus 1.0 \
  --log-opt max-size=10m --log-opt max-file=2 \
  --env-file "$PROJECT_DIR/.env.ssd" \
  -e NODE_ENV=production -e PORT=3003 \
  -e DATABASE_PATH=/app/data/reading-tracker.db \
  -e CORS_ORIGIN="http://${HOST_BIND}:${HOST_PORT}" \
  -e CLIPPINGS_SYNC_MINUTES=0 \
  -p "${HOST_BIND}:${HOST_PORT}:3003" \
  -v "$PREVIEW_DIR/data:/app/data" \
  -v "$PREVIEW_DIR/logs:/app/logs" \
  -v "$PREVIEW_DIR/backups:/app/backups" \
  --tmpfs /tmp:noexec,nosuid,size=100m \
  "$IMAGE" >/dev/null

for _ in $(seq 1 30); do
  if curl -fsS "http://${HOST_BIND}:${HOST_PORT}/api/health" >/dev/null 2>&1; then
    echo "==> Preview running at http://${HOST_BIND}:${HOST_PORT}"
    exit 0
  fi
  sleep 3
done
echo "!! Preview did not become healthy" >&2
docker logs --tail 40 "$CONTAINER" >&2
exit 1
