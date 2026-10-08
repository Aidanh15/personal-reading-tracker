# Personal Reading Tracker

Personal reading dashboard: reading plan, progress tracking, Kindle highlights, and a daily highlight review. Self-hosted on this Raspberry Pi (arm64).

- **Live:** http://100.125.191.12:3004 (Tailscale IP), container `reading-tracker-ui-test`
- **Repo:** https://github.com/Aidanh15/personal-reading-tracker — work on feature branches, merge via PR into `main`
- **This checkout** (`/mnt/SSD/projects/personal-reading-tracker`) is the canonical working copy. The container bind-mounts `data/`, `logs/`, `backups/` and `imports/` from here, and reads `.env.ssd` (gitignored, never commit it).

## Stack

- `backend/`: Express + TypeScript + better-sqlite3. Routes are in `src/routes/` (books, highlights, review, search, covers), SQL in `src/database/queries/`, schema in `src/database/schema.sql`, migrations in `src/database/migrations.ts`.
- `frontend/`: React 18 + Vite + Tailwind + react-router. Pages are in `src/pages/` (Dashboard, BookDetail, Review, SearchPage). The master reading plan is in `src/data/readingPlan.ts`.
- In production, the backend serves the built frontend from a single container on port 3003 (mapped to host port 3004).

## Deploying

```bash
./scripts/redeploy.sh
```

The script builds the working tree into an image tagged `personal-reading-tracker:<sha>[-dirty]`, then copies `data/reading-tracker.db*` to `backups/pre-deploy-<timestamp>/`. It replaces the container, keeping the old one as `reading-tracker-ui-test-prev`. Finally it polls `/api/health` and rolls back automatically if the check fails. Building on the Pi takes ~10 minutes, so batch enhancements and deploy them together (see Pending deploy below).

**Preview first, then promote** (one build per batch):

```bash
docker build -t personal-reading-tracker:$(git rev-parse --short HEAD) .
./scripts/preview.sh start personal-reading-tracker:<sha>   # http://100.125.191.12:3005 on a snapshot of the live library
./scripts/preview.sh stop
IMAGE=personal-reading-tracker:<sha> ./scripts/redeploy.sh   # promote the same image, no rebuild
```

The preview's copy of the data lives in `preview-data/` (gitignored) and is re-snapshotted on each `start`, unless `--keep-data` is given. Clippings sync is disabled in the preview.

On startup, `scripts/docker-entrypoint.sh` seeds the DB only if it is empty. (The old `sync-reading-plan` step was retired in Oct 2026; the reading list is edited in the app.)

## Gotchas

- **Live data:** `data/reading-tracker.db` is the user's real library (WAL mode). Never delete, reseed or reset it. Avoid `seed:reset*` / `seed:clear` against it. Startup code must never override a status the reader has changed (forced statuses apply only to `not_started` books).
- **Dev data:** for local dev, point `DATABASE_PATH` at a copy (e.g. in `tmp/`).
- **Filesystem:** the SSD is NTFS (fuseblk), deliberately, so it can be moved to a Windows machine. Don't suggest reformatting it. Everything is root-owned with 0777 permissions. Permission-preserving operations fail (`cp -p`, chmod/chown), so never use them on project files. Git needs `safe.directory` entries (already configured globally).
- **Node versions:** the host has Node 18, but the Docker images use Node 20. Prefer running builds inside Docker if versions matter.
- **Testing:** there is no CI and no UI tests, on purpose (single-user personal site). The only suite is `backend/src/__tests__/data-safety.test.ts`, which guards saved progress, highlights and review state against everything that runs on deploy. Run `./scripts/test.sh` before deploying any change to `seed.ts`, `connection.ts`/`schema.sql`, the Kindle import, or the entrypoint. It runs in Docker with only `backend/` mounted, so it can't touch the live DB. When adding a new startup or import step, extend that test.
- **Old draft:** local branch `backup/ssd-uncommitted-draft-2026-05` holds a superseded uncommitted draft that was found in this checkout. It is kept for reference only.
- **Compose files:** `docker-compose*.yml` describe an older deployment on port 3003, retired Jul 2026. Don't `docker compose up` them: that would start a second instance on the same live DB. Use `scripts/redeploy.sh`.
- **Old Codex worktree:** `/home/pi/Documents/Codex/2026-07-10-let-s-taking-a-look-at/reading-tracker-worktree` is a leftover worktree of this repo on the already-merged `feature/final-reading-list-modern-ui` branch.

## Pending deploy

Changes committed but not yet live (clear this list after each `scripts/redeploy.sh`):

- (none)

Not deployable yet: Kindle highlight auto-sync, host side. rclone from Google Drive (clippings.io Auto Export folder) into `imports/clippings/`, scheduled once a day. Waiting on the user's clippings.io Auto Export setup. The app side is live.

## Backlog (ideas, not started)

- **Discuss with Claude (per book):** a button on each book that opens a guided discussion with Claude about it. The questions should be specific and well researched, grounded in the book itself. At the end, Claude writes a review *from the user's perspective*, based on their answers, which is saved on the book to look back on. Open questions: Claude API key and cost, using web search/research for less-known books, where to store transcripts, and whether the review becomes `personal_review` or a separate history.
