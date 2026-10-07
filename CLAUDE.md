# Personal Reading Tracker

Personal reading dashboard: reading plan, progress tracking, Kindle highlights, and a daily highlight review. Self-hosted on this Raspberry Pi (arm64).

- **Live:** http://100.125.191.12:3004 (Tailscale IP), container `reading-tracker-ui-test`
- **Repo:** https://github.com/Aidanh15/personal-reading-tracker — work on feature branches, merge via PR into `main`
- **This checkout** (`/mnt/SSD/projects/personal-reading-tracker`) is the canonical working copy. The container bind-mounts `data/`, `logs/`, `backups/` and `imports/` from here, and reads `.env.ssd` (gitignored, never commit it).

## Stack

- `backend/`: Express + TypeScript + better-sqlite3. Routes are in `src/routes/` (books, highlights, review, search, covers), SQL in `src/database/queries/`, schema in `src/database/schema.sql`, migrations in `src/database/migrations.ts`. Jest tests.
- `frontend/`: React 18 + Vite + Tailwind + react-router. Pages are in `src/pages/` (Dashboard, BookDetail, Review, SearchPage). The master reading plan is in `src/data/readingPlan.ts`. Vitest tests.
- `e2e/`: Playwright.
- In production, the backend serves the built frontend from a single container on port 3003 (mapped to host port 3004).

## Deploying

```bash
./scripts/redeploy.sh
```

The script builds the working tree into an image tagged `personal-reading-tracker:<sha>[-dirty]`, then copies `data/reading-tracker.db*` to `backups/pre-deploy-<timestamp>/`. It replaces the container, keeping the old one as `reading-tracker-ui-test-prev`. Finally it polls `/api/health` and rolls back automatically if the check fails. Building on the Pi takes several minutes.

On startup, `scripts/docker-entrypoint.sh` seeds the DB only if it is empty, then runs `sync-reading-plan`. That sync reconciles the numbered master list without resetting progress.

## Gotchas

- **Live data:** `data/reading-tracker.db` is the user's real library (WAL mode). Never delete, reseed or reset it. Avoid `seed:reset*` / `seed:clear` against it.
- **Dev data:** for local dev, point `DATABASE_PATH` at a copy (e.g. in `tmp/`).
- **Filesystem:** the SSD is NTFS (fuseblk). Everything is root-owned with 0777 permissions, so git needs `safe.directory` entries (already configured globally). Symlinks and exec bits can be unreliable.
- **Node versions:** the host has Node 18, but the Docker images use Node 20. Prefer running builds inside Docker if versions matter.
- **CI:** there is no CI on purpose (single-user personal site). Before deploying, run the relevant tests locally if needed.
- **Old draft:** local branch `backup/ssd-uncommitted-draft-2026-05` holds a superseded uncommitted draft that was found in this checkout. It is kept for reference only.
- **Old Codex worktree:** `/home/pi/Documents/Codex/2026-07-10-let-s-taking-a-look-at/reading-tracker-worktree` is a leftover worktree of this repo on the already-merged `feature/final-reading-list-modern-ui` branch.
