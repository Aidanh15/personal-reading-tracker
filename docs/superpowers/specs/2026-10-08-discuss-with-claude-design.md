# Discuss with Claude: design

Date: 2026-10-08
Status: approved in brainstorming, awaiting spec review

## Goal

On a completed book, a "Discuss with Claude" button opens a chat in which Claude, having researched the book and read the reader's highlights, interviews the reader about it. When the reader has said enough, Claude writes a review **in the reader's voice, from the views they expressed**, plus a score. The reader edits it and can save it as the book's review. Every discussion is kept, with its transcript, to look back on.

Single-user, self-hosted on the Pi, reached over Tailscale. It uses the Claude Code CLI already installed and logged in on the Pi (headless `claude -p`), so usage counts against the reader's Claude plan. No Anthropic API key.

## Decisions

| Topic | Decision |
|---|---|
| Claude access | Local Claude Code CLI via a host-side bridge service (not inside the container, no API key) |
| Discussion shape | Claude-led interview: one question at a time; the reader chooses when to write the review |
| Saving | Full history: transcript + review draft per discussion; "Save as my review" copies to the book |
| Availability | Completed books only (endings are fair game) |
| Ratings | Quarter stars (0.25 steps), app-wide |
| Tools for Claude | WebSearch and WebFetch only |

## Architecture

```
browser ──SSE──▶ backend container ──HTTP (NDJSON)──▶ claude-bridge (host, user pi) ──spawn──▶ claude -p
                    │ SQLite: discussions, discussion_messages
```

### 1. claude-bridge (host service)

- `bridge/server.ts` in the repo, run by the host's Node 18 with no dependencies beyond Node built-ins (`http`, `child_process`). The `claude-bridge.service` systemd unit (source in `scripts/systemd/`, installed to `/etc/systemd/system/`) runs it as user `pi` with `Restart=on-failure`.
- Listens on `172.17.0.1:3010` only (the Docker bridge gateway, which the app container can reach; the tailnet and LAN can't). Each request must carry `Authorization: Bearer $CLAUDE_BRIDGE_TOKEN`. The token is in `.env.ssd` for the app and in `.env.bridge` (gitignored) for the bridge, alongside `CLAUDE_BRIDGE_MODEL` (default `opus`).
- `POST /turn` with body `{ sessionId: uuid, resume: boolean, systemPrompt?: string, message: string }` spawns:
  ```
  claude -p (--session-id <uuid> | --resume <uuid>)
         --output-format stream-json --include-partial-messages --verbose
         --tools WebSearch,WebFetch --strict-mcp-config --setting-sources ""
         [--system-prompt <systemPrompt>]   (first turn only)
         --model $CLAUDE_BRIDGE_MODEL
  ```
  The message goes in on stdin, never in argv. The working directory is an empty `~/.local/share/claude-bridge/`. The CLI's stream-json lines are relayed as NDJSON.
- `--setting-sources ""` and `--strict-mcp-config` keep the user's plugins, hooks, MCP servers and CLAUDE.md out of discussion sessions.
- Only one turn runs at a time; a concurrent request gets `409 busy`. Each turn has a 5-minute timeout (the child is killed and an error event is sent). If the backend's connection drops, the child is killed. A browser disconnect doesn't drop it: the backend stays connected to the bridge, finishes reading the turn and saves it (see section 2).
- `GET /health` (no token needed) returns `{ ok, claudeVersion }`.

### 2. Backend and data

**Tables** (additive, `CREATE TABLE IF NOT EXISTS` in `schema.sql`):

```sql
discussions (
  id INTEGER PRIMARY KEY, book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  claude_session_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','reviewed')),
  model TEXT, review_draft TEXT, review_rating REAL, applied_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP, updated_at TEXT DEFAULT CURRENT_TIMESTAMP
)
discussion_messages (
  id INTEGER PRIMARY KEY, discussion_id INTEGER NOT NULL REFERENCES discussions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')), kind TEXT NOT NULL DEFAULT 'chat' CHECK (kind IN ('chat','review')),
  content TEXT NOT NULL, created_at TEXT DEFAULT CURRENT_TIMESTAMP
)
```

The transcript lives in the app database, so it doesn't depend on Claude's session files surviving.

**Session recovery (transcript replay).** If a `--resume` turn fails because the Claude session can't be found (the bridge reports this as `{ type: "error", code: "session_not_found" }`, detected from the CLI's error output), the backend recovers automatically within the same request:
1. It generates a new session UUID.
2. It runs a first turn with the normal system prompt plus a **"Discussion so far"** block containing the saved transcript (chat and review messages, in order, labelled Reader/Claude). The turn's message is the one that was pending: the reader's answer or the review request.
3. On success, it updates `discussions.claude_session_id` to the new UUID.

The reader sees one extra status line ("Reconnecting to the discussion…") and nothing else changes. Claude's private research context from earlier turns (fetched pages) isn't carried over; the transcript holds the substance, and Claude may search again. If the replay turn also fails, the usual retryable error is shown.

**Quarter-star ratings.** `books.personal_rating` changes from `INTEGER CHECK (1..5)` to `REAL CHECK (personal_rating BETWEEN 1 AND 5 AND personal_rating * 4 = CAST(personal_rating * 4 AS INTEGER))`. SQLite can't alter a CHECK constraint, so the `books` table is rebuilt once, following the existing rebuild pattern in `connection.ts`:
- It runs only when the stored table definition still has the old constraint, so it's idempotent.
- It runs in a transaction with foreign keys off, copies every column, and preserves ids, so highlights, review state and the daily queue stay attached.
- `data-safety.test.ts` is extended. It checks that every book's progress, status, dates, rating, review and cover survive, that whole-star ratings are unchanged, that highlights and `highlight_reviews` are intact, and that a second run is a no-op.
- Validation (`middleware/validation.ts`) accepts 1–5 in 0.25 steps. The `personalReview` limit rises from 5000 to 10000 characters.

**Routes** (`routes/discussions.ts`):

| Route | Behaviour |
|---|---|
| `GET /api/claude/health` | Proxies bridge `/health`; `{ ok: false }` when unreachable |
| `GET /api/books/:id/discussions` | List: id, status, dates, rating, first line of the draft |
| `POST /api/books/:id/discussions` | `409` unless the book is completed. Creates a row with a new session UUID, builds the system prompt (section 4), and runs the kickoff turn. Streams |
| `GET /api/discussions/:id` | Discussion + messages |
| `POST /api/discussions/:id/messages` `{ content }` | Saves the user message, runs the turn, saves the assistant reply. Streams |
| `POST /api/discussions/:id/review` `{ instructions? }` | Runs the review turn (optionally with change instructions), parses it, and stores `review_draft`/`review_rating`; status becomes `reviewed`. Streams |
| `PUT /api/discussions/:id/review` `{ draft, rating }` | Saves the reader's edits |
| `POST /api/discussions/:id/apply` | Copies the draft and rating to `books.personal_review` / `personal_rating`, and sets `applied_at` |
| `DELETE /api/discussions/:id` | Deletes the discussion and its messages; the book's review is untouched |

**Streaming to the browser:** server-sent events: `status` (e.g. `{ text: "Searching: …" }`, derived from tool-use events), `delta` (text chunks), `done` (`{ messageId }`, plus the parsed draft and rating for review turns), and `error` (`{ message, retryable }`). The user message is saved before the bridge call; the assistant message is saved when the turn completes, even if the browser has gone. A failed turn saves no assistant message; the UI offers Retry, which resends the last user message without saving it twice.

**Review parsing:** the review turn must answer `<review>…</review><rating>N</rating>`. The rating is snapped to the nearest 0.25 within 1–5; if it's missing or invalid, the rating is null. If the `<review>` tags are missing, the whole reply becomes the draft.

### 3. Frontend

- **BookDetail** (completed books only):
  - The button reads "Discuss with Claude", or "Continue discussion" if one is still `active` and not yet reviewed.
  - A "Discussions" list shows date, rating and draft snippet; tapping one opens it.
  - When `/api/claude/health` is not ok, the button is disabled and reads "Claude unavailable".
- **Discussion page** `/books/:id/discuss/:discussionId`, full-screen:
  - Header: back arrow, book title, and a "Write my review" button, active after at least one user answer.
  - Messages: Claude on the left, the reader on the right, in the app's paper style, rendered as plain paragraphs (`whitespace-pre-wrap`) with no Markdown dependency.
  - While a turn runs, a subtle status line (`status` events) shows, then the reply streams in.
  - Input: an auto-growing textarea. Enter sends on desktop (Shift+Enter for a newline); on touch devices, only the button sends.
  - Errors appear inline with Retry.
- **Review panel**, after "Write my review":
  - An editable draft textarea and a quarter-step rating picker (stars + number).
  - Save draft → `PUT`.
  - Ask for changes → `POST review { instructions }`.
  - Save as my review → `POST apply`, with a confirmation if the book already has a review.
  - The reader can go back to the chat and regenerate the review later.
- **Quarter stars elsewhere:** `ProgressTracker`'s rating input and star displays support 0.25 steps (partial star fill).

### 4. Prompts

**System prompt** (first turn), built in the backend:
- The book's title, authors, start and finish dates, and existing rating, if any.
- All highlights with their notes. The largest book has about 70.
- Voice examples: up to two of the reader's most recent saved `personal_review`s from other books, plus a style guide: opinionated, conversational, argument-led rather than summary, humour welcome, a short verdict up front, the score at the end.
- Interview rules:
  - Research first: use existing knowledge, and use web search for lesser-known books or where specifics help (reception, author context, translations). Don't narrate the research.
  - Ask one question per message. Keep replies to a few sentences plus the next question. Use plain prose, no Markdown.
  - Make questions specific: name scenes, characters, arguments and turning points, and use the reader's highlights as openings.
  - Follow up on interesting answers. Push back and steelman the author when the reader criticises; don't flatter.
  - Cover the reader's overall reaction, characters, ideas, the writing, what didn't work and a verdict, and ask for a score near the end.
  - After roughly 8–15 exchanges, Claude may suggest writing the review, but never forces it.

**Kickoff message:** "Start the discussion." Claude researches as needed, then opens with a line or two and its first question.

**Review turn message:**
- Write the review in the reader's voice, first person, using only views the reader expressed in this discussion.
- It may tighten and organise their arguments and keep their phrasing and jokes, but must not invent opinions.
- No plot summary. Length in proportion to the discussion. Verdict first, score last.
- Output exactly `<review>…</review><rating>N</rating>`, with N in 0.25 steps (or omit `<rating>` if no score was given).
- With change instructions, the same rules apply, plus the instructions, applied to the previous draft.

## Error handling summary

- **Bridge down:** health check fails → button disabled. A failure mid-turn → `error` event, retryable.
- **Busy (409) or timeout:** a retryable error in the UI.
- **Session missing on resume:** recovered automatically by transcript replay (section 2). Only a failure of the replay turn itself reaches the UI, as a retryable error.
- **Book not completed:** `409` from `POST /api/books/:id/discussions`; the button isn't shown anyway.

## Testing

- `data-safety.test.ts`: the ratings rebuild (see section 2), and new tables created without touching existing rows.
- Backend unit tests (Jest, existing setup), using a fake bridge client:
  - review parsing: tags present or missing, rating snapping, invalid rating;
  - system-prompt building: highlights and voice examples included, and the transcript block on replay;
  - the status flow for completed versus other books;
  - session recovery: `session_not_found` → replay turn with the full transcript and the pending message → `claude_session_id` updated, with no duplicate user message saved.
- Bridge: a manual smoke test with a real one-turn and a resumed turn, a resume of a nonexistent session (must yield `session_not_found`), plus a check that the token is enforced and that `--tools` blocks Bash.
- UI: manual check in the preview (`scripts/preview.sh`) before promoting. No UI test suite, per project convention.

## Deploy notes

- Host side: install `claude-bridge.service`, create `.env.bridge`, and add `CLAUDE_BRIDGE_URL=http://172.17.0.1:3010` and `CLAUDE_BRIDGE_TOKEN` to `.env.ssd`.
- App side: one image build. Preview first (the preview container can also reach the bridge), then promote with `redeploy.sh`, whose DB backup covers the ratings rebuild.
- CLAUDE.md: document the bridge, and remove the backlog entry once the feature is live.

## Out of scope

- Discussions for in-progress or unstarted books.
- Markdown rendering, multiple concurrent discussions, and exporting reviews to StoryGraph.
