#!/bin/bash
# Run the backend data-safety tests in a throwaway Node 20 container (same as production).
# Only backend/ is mounted, so the tests cannot reach the live database in data/.
# Dependencies are cached in a Docker volume to keep reruns fast and off the NTFS SSD.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "$0")/../backend" && pwd)"

docker run --rm \
  -v "$BACKEND_DIR:/app" \
  -v reading_tracker_test_node_modules:/app/node_modules \
  -w /app \
  node:20-alpine \
  sh -c 'npm ci --no-audit --no-fund --loglevel=error && npx jest "$@"' -- "$@"
