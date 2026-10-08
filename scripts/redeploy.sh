#!/bin/bash
# Rebuild and redeploy the live reading tracker at http://100.125.191.12:3004
#
# Builds the current working tree into an image, backs up the SQLite DB,
# swaps the container, health-checks it, and rolls back if it fails.
# The previous container is kept (stopped) as "<name>-prev" until the next deploy.
set -euo pipefail

PROJECT_DIR=/mnt/SSD/projects/personal-reading-tracker
CONTAINER=${CONTAINER:-reading-tracker-ui-test}
HOST_BIND=100.125.191.12
HOST_PORT=3004
HEALTH_URL="http://${HOST_BIND}:${HOST_PORT}/api/health"

cd "$PROJECT_DIR"

SHA=$(git rev-parse --short HEAD)
DIRTY=$(git status --porcelain --untracked-files=no | grep -q . && echo "-dirty" || true)
TAG="personal-reading-tracker:${SHA}${DIRTY}"

echo "==> Building ${TAG}"
docker build -t "$TAG" .

echo "==> Backing up database"
STAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR="backups/pre-deploy-${STAMP}"
mkdir -p "$BACKUP_DIR"

# From here until the new container is running, any failure restarts the old one
# so the site is never left down.
STOPPED_OLD=0
RENAMED=0
SWAPPED=0
on_error() {
  [ "$STOPPED_OLD" = 1 ] && [ "$SWAPPED" = 0 ] || return 0
  echo "!! Deploy failed before the swap; restarting the previous container" >&2
  if [ "$RENAMED" = 1 ]; then
    docker rm -f "$CONTAINER" >/dev/null 2>&1 || true
    docker rename "${CONTAINER}-prev" "$CONTAINER" || true
  fi
  docker start "$CONTAINER" >/dev/null || true
}
trap on_error ERR

if docker ps -q -f "name=^${CONTAINER}$" | grep -q .; then
  docker stop "$CONTAINER" >/dev/null
  STOPPED_OLD=1
fi
# No -p: the SSD is NTFS and refuses permission changes
cp data/reading-tracker.db* "$BACKUP_DIR"/
echo "    saved to ${BACKUP_DIR}"

echo "==> Swapping container"
docker rm -f "${CONTAINER}-prev" >/dev/null 2>&1 || true
if docker ps -aq -f "name=^${CONTAINER}$" | grep -q .; then
  docker rename "$CONTAINER" "${CONTAINER}-prev"
  RENAMED=1
fi

docker run -d --name "$CONTAINER" \
  --restart unless-stopped \
  --security-opt no-new-privileges:true \
  --memory 512m --cpus 1.0 \
  --ulimit nproc=1024 --ulimit nofile=2048:4096 \
  --log-opt max-size=20m --log-opt max-file=5 \
  --env-file "$PROJECT_DIR/.env.ssd" \
  -e NODE_ENV=production -e PORT=3003 \
  -e DATABASE_PATH=/app/data/reading-tracker.db \
  -e CORS_ORIGIN="http://${HOST_BIND}:${HOST_PORT}" \
  -p "${HOST_BIND}:${HOST_PORT}:3003" \
  -v "$PROJECT_DIR/data:/app/data" \
  -v "$PROJECT_DIR/logs:/app/logs" \
  -v "$PROJECT_DIR/backups:/app/backups" \
  -v "$PROJECT_DIR/imports:/app/imports" \
  -v reading_tracker_tmp:/app/tmp \
  --tmpfs /tmp:noexec,nosuid,size=100m \
  "$TAG" >/dev/null
SWAPPED=1
trap - ERR

echo "==> Waiting for health check at ${HEALTH_URL}"
for _ in $(seq 1 30); do
  if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
    echo "==> Deployed ${TAG} — healthy"
    exit 0
  fi
  sleep 3
done

echo "!! Health check failed; rolling back" >&2
docker logs --tail 40 "$CONTAINER" >&2 || true
docker rm -f "$CONTAINER" >/dev/null
if docker ps -aq -f "name=^${CONTAINER}-prev$" | grep -q .; then
  docker rename "${CONTAINER}-prev" "$CONTAINER"
  docker start "$CONTAINER" >/dev/null
  echo "!! Previous container restored (DB backup in ${BACKUP_DIR})" >&2
fi
exit 1
