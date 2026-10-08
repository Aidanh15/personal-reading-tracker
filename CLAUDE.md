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

On startup, `scripts/docker-entrypoint.sh` seeds the DB only if it is empty, then runs `sync-reading-plan`. That sync reconciles the numbered master list without resetting progress.

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

- Reading-list editing backend: new `books` columns (phase, milestone, category, parallel_track, unscheduled); Up Next API (`GET /books/lookup`, `POST`/`PUT /books/up-next`, `PUT /books/:id/schedule`); delete refused while a book has highlights.
- Startup reading-plan sync retired (the DB is now the source of truth). The Kindle importer uses strict title matching; unknown titles go to Unscheduled.
- Up Next editing UI: press-and-hold to reorder (@dnd-kit), swipe left (or the hover trash button) to remove with confirmation (Unscheduled or delete), Add book with Open Library/Google Books search and covers, Unscheduled shelf. Phases and milestones are now per book (`frontend/src/data/readingPlan.ts` removed).
- Kindle highlight auto-sync, app side: `services/clippingsSync.ts` imports new/changed clippings.io Markdown files from `imports/clippings/` once a day and at startup (`CLIPPINGS_SYNC_MINUTES`, `CLIPPINGS_SYNC_DIR`); the user syncs to clippings.io about weekly, from desktop only; `GET`/`POST /api/sync/clippings`. Host side still to do: rclone from Google Drive into `imports/clippings/` (waiting on the user's clippings.io Auto Export setup).
- **After deploying, run once:** `docker exec reading-tracker-ui-test sh -c 'cd backend && node dist/scripts/seed.js apply-reading-list --dry-run'`, review the report, then run it without `--dry-run`. This applies `list.txt` (Oct 2026) and cleans up duplicate books and misattributed highlights.

## Backlog (ideas, not started)

- **Discuss with Claude (per book):** a button on each book that opens a guided discussion with Claude about it. The questions should be specific and well researched, grounded in the book itself. At the end, Claude writes a review *from the user's perspective*, based on their answers, which is saved on the book to look back on. Open questions: Claude API key and cost, using web search/research for less-known books, where to store transcripts, and whether the review becomes `personal_review` or a separate history.
