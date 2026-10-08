# Discuss with Claude Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On a completed book, the reader discusses it with Claude (via the Claude Code CLI on the Pi). Claude then writes a review in the reader's voice, which is saved with the transcript and can be applied to the book with a quarter-star rating.

**Architecture:** A host-side bridge (`bridge/server.mjs`, systemd, user `pi`, bound to `172.17.0.1:3010`) spawns `claude -p` per turn and relays stream-json as NDJSON. The backend owns everything else: discussion tables, prompt building, turn orchestration with transcript-replay recovery, and SSE to the browser. The frontend adds a discussion page and quarter-star rating UI.

**Tech Stack:** Express + TypeScript + better-sqlite3 + zod + Jest (backend, Node 20 in Docker); plain Node 18 ESM + `node:test` (bridge, host); React 18 + Vite + Tailwind + react-router + axios (frontend).

**Spec:** `docs/superpowers/specs/2026-10-08-discuss-with-claude-design.md`

## Global Constraints

- Live DB `data/reading-tracker.db` is never touched by tests or development. Backend tests run only via `./scripts/test.sh`, which mounts only `backend/`.
- No `cp -p`, chmod or chown on project files (NTFS SSD).
- Bridge: no npm dependencies; Node 18 built-ins only; runs as `pi`; listens on `172.17.0.1:3010` only. `POST /turn` requires `Authorization: Bearer $CLAUDE_BRIDGE_TOKEN`; `GET /health` needs no token.
- CLI flags, exactly: `-p (--session-id <uuid> | --resume <uuid>) --output-format stream-json --include-partial-messages --verbose --tools WebSearch,WebFetch --allowedTools WebSearch,WebFetch --strict-mcp-config --setting-sources "" --system-prompt <prompt> --model <CLAUDE_BRIDGE_MODEL>`. The message goes on stdin, never in argv.
- Bridge cwd for the CLI: `~/.local/share/claude-bridge/` (created if missing). Turn timeout: 5 minutes. One turn at a time (`409 busy`).
- Env: `.env.bridge` (gitignored): `CLAUDE_BRIDGE_TOKEN`, `CLAUDE_BRIDGE_MODEL` (default `opus`). `.env.ssd`: `CLAUDE_BRIDGE_URL=http://172.17.0.1:3010`, `CLAUDE_BRIDGE_TOKEN`. No secrets, Drive IDs or personal URLs are committed (the repo is public).
- Ratings: 1–5 in 0.25 steps everywhere (DB CHECK, zod, UI). `personalReview` max 10000 characters.
- Discussions only for books with `status = 'completed'`.
- Claude replies are rendered as plain text (`whitespace-pre-wrap`); no Markdown dependency.
- The system prompt is rebuilt from the DB and sent on **every** turn.

## Review Focus

1. **Browser closed or phone locked mid-reply:** the turn must still complete and the assistant message be saved; reopening shows it. Pinned in Task 5 (`persists the reply when the listener throws`).
2. **Double tap on Send / two tabs:** a second turn on a discussion that's already running is rejected (`409`) and never saves a second user message. Pinned in Task 5 (`rejects a concurrent turn without saving it`).
3. **Retry after a failed turn:** resends the pending user message without saving it twice. Pinned in Task 5 (`retry reuses the unanswered user message`).
4. **Odd ratings:** Claude writes `4.3` or `6`, or the reader types `4.1`. Parsed ratings are snapped or clamped; a manual non-quarter rating is rejected with `400`. Pinned in Task 4 (`parseReview snaps…`) and Task 6 (zod schema test).
5. **Highlights or answers containing `<review>`-like text or quotes:** must not break review parsing; the parser takes the **last** `<review>…</review>` block. Pinned in Task 4.

---

## File Structure

| File | Responsibility |
|---|---|
| `backend/src/database/schema.sql` (modify) | Quarter-star CHECK for new DBs; `discussions`, `discussion_messages` tables |
| `backend/src/database/connection.ts` (modify) | `ensureQuarterStarRatings()` one-time books rebuild |
| `backend/src/middleware/validation.ts` (modify) | `ratingSchema` (0.25 steps), review max 10000 |
| `backend/src/database/queries/discussions.ts` (create) | All SQL for discussions/messages |
| `backend/src/services/claudeBridge.ts` (create) | HTTP client to the bridge; CLI event → app event translation |
| `backend/src/services/discussionPrompts.ts` (create) | System prompt, kickoff/review messages, review parsing |
| `backend/src/services/discussions.ts` (create) | Turn orchestration, locking, recovery, apply |
| `backend/src/routes/discussions.ts` (create) | REST + SSE endpoints |
| `backend/src/index.ts` (modify) | Mount routers |
| `bridge/server.mjs`, `bridge/cli.mjs`, `bridge/cli.test.mjs` (create) | Host bridge; pure arg building and error detection, with tests |
| `scripts/systemd/claude-bridge.service` (create) | Bridge unit |
| `frontend/src/components/UI/StarRating.tsx` (create) | Quarter-star display + picker |
| `frontend/src/services/discussionsApi.ts` (create) | REST calls + SSE-over-fetch reader |
| `frontend/src/pages/Discussion.tsx` (create) | Chat page + review panel |
| `frontend/src/components/Discussions/BookDiscussions.tsx` (create) | Button + list on BookDetail |
| `frontend/src/pages/BookDetail.tsx`, `ProgressTracker.tsx`, `App.tsx`, `types/index.ts` (modify) | Wire-up, quarter stars, route |

Frontend type check (no UI tests, per project convention), used in Tasks 7–9:
`docker run --rm -v "$PWD/frontend:/app" -v reading_tracker_fe_node_modules:/app/node_modules -w /app node:20-alpine sh -c 'npm ci --no-audit --no-fund --loglevel=error && npx tsc --noEmit -p . && npx vite build'`. Expected: exit 0.

---

### Task 1: Quarter-star ratings in the database and validation

**Files:**
- Modify: `backend/src/database/schema.sql:15`
- Modify: `backend/src/database/connection.ts` (add `ensureQuarterStarRatings`, call it after `ensureReadingListColumns()` and before the second `this.db.exec(schema)`)
- Modify: `backend/src/middleware/validation.ts:24-25`
- Test: `backend/src/__tests__/data-safety.test.ts` (new `describe('quarter-star rating upgrade')`)

**Interfaces:**
- Produces: `export const ratingSchema` (zod number, 1–5, multiple of 0.25) exported from `middleware/validation.ts`, used by Task 6.
- New CHECK text (exact, used in both `schema.sql` and the rebuild): `personal_rating REAL CHECK (personal_rating >= 1 AND personal_rating <= 5 AND personal_rating * 4 = CAST(personal_rating * 4 AS INTEGER))`

- [ ] **Step 1: Write the failing tests** in `data-safety.test.ts`, following the existing `did-not-finish schema upgrade` test's pattern (old schema file → insert rows → `jest.isolateModules` + `require('../database/connection')`):

```ts
describe('quarter-star rating upgrade', () => {
    it('upgrades an integer-rating database keeping every book column, highlight and review state', () => {
        // old schema = current schema.sql with the REAL/quarter CHECK replaced by
        // 'personal_rating INTEGER CHECK (personal_rating >= 1 AND personal_rating <= 5)'
        // rows: book 1 with rating 4, review 'Great.', status 'completed', phase 'Phase 1', parallel_track 1, unscheduled 0,
        //       started/completed dates, cover_image_url '/covers/x.jpg'; book 2 with rating NULL, status 'in_progress', progress 37
        // highlight 1 on book 1 + highlight_reviews(review_count 3, favorite 1)
        // after opening the connection:
        expect(upgraded.prepare('SELECT * FROM books ORDER BY id').all()).toEqual(rowsBefore); // every column identical
        expect(upgraded.prepare('SELECT personal_rating FROM books WHERE id = 1').get()).toEqual({ personal_rating: 4 });
        upgraded.prepare('UPDATE books SET personal_rating = 4.25 WHERE id = 1').run();          // accepted
        expect(() => upgraded.prepare('UPDATE books SET personal_rating = 4.3 WHERE id = 1').run()).toThrow(/CHECK/);
        expect(() => upgraded.prepare('UPDATE books SET personal_rating = 5.25 WHERE id = 1').run()).toThrow(/CHECK/);
        // highlights + highlight_reviews unchanged; triggers and indexes exist again:
        expect(upgraded.prepare("SELECT count(*) AS n FROM sqlite_master WHERE tbl_name = 'books' AND type IN ('index','trigger')").get()).toEqual({ n: 4 });
    });

    it('is a no-op on an already upgraded database', () => {
        // open the upgraded DB a second time (isolateModules again): the books table SQL is unchanged
        // and SELECT * FROM books returns identical rows
    });
});
```

The `rowsBefore` snapshot is taken with `SELECT * FROM books ORDER BY id` on the old DB before closing it, and compared right after opening the upgraded DB, before any UPDATE (the rebuild itself performs none, so the timestamp trigger doesn't fire).

- [ ] **Step 2: Run** `./scripts/test.sh -t "quarter-star"`. Expected: FAIL (the 4.25 update throws a CHECK error).

- [ ] **Step 3: Implement**
  - `schema.sql` line 15: use the new CHECK text.
  - `connection.ts`: add `private ensureQuarterStarRatings(): void`:
    - Read `sqlite_master.sql` for `books`, and return if it already contains `personal_rating REAL`.
    - Build the new table SQL by replacing the table name with `books_rating_upgrade` and the old rating definition (regex `/personal_rating INTEGER CHECK \(personal_rating >= 1 AND personal_rating <= 5\)/`) with the new CHECK text. If the regex doesn't match, `console.warn` and return; never block startup.
    - Copy all columns listed by `PRAGMA table_info(books)`, by name.
    - Use the same `foreign_keys = OFF`, `BEGIN`/`COMMIT`, rollback-on-error structure as `ensureDidNotFinishStatus()`, and log `Database upgraded to quarter-star ratings`.
    - Call it from `initializeSchema` right after `ensureReadingListColumns()`.
  - `validation.ts`: `export const ratingSchema = z.number().min(1).max(5).refine(n => Number.isInteger(n * 4), 'Rating must be in steps of 0.25')`. Use it for `personalRating`, and change `personalReview` to `.max(10000)`.

- [ ] **Step 4: Run** `./scripts/test.sh`. Expected: all suites PASS, including the existing `did-not-finish schema upgrade` (its old DB goes through both rebuilds).

- [ ] **Step 5: Commit** `git commit -m "Quarter-star ratings: one-time books rebuild, validation"`.

---

### Task 2: Discussion tables and queries

**Files:**
- Modify: `backend/src/database/schema.sql` (append the tables + index `idx_discussions_book ON discussions (book_id, created_at)` + `update_discussions_timestamp` trigger, mirroring `update_books_timestamp`)
- Create: `backend/src/database/queries/discussions.ts`
- Test: `backend/src/__tests__/discussions.test.ts`

**Interfaces:**
- Produces (types exported from `queries/discussions.ts`):
```ts
export type DiscussionStatus = 'active' | 'reviewed';
export type MessageRole = 'user' | 'assistant';
export type MessageKind = 'chat' | 'review';
export interface Discussion { id: number; bookId: number; claudeSessionId: string; status: DiscussionStatus; model: string | null;
  reviewDraft: string | null; reviewRating: number | null; appliedAt: string | null; createdAt: string; updatedAt: string; }
export interface DiscussionMessage { id: number; discussionId: number; role: MessageRole; kind: MessageKind; content: string; createdAt: string; }
export const DiscussionQueries: {
  create(bookId: number, claudeSessionId: string, model: string | null): Discussion;
  get(id: number): Discussion | null;
  listForBook(bookId: number): Discussion[];            // newest first
  messages(discussionId: number): DiscussionMessage[];   // oldest first (by id)
  addMessage(discussionId: number, role: MessageRole, kind: MessageKind, content: string): DiscussionMessage;
  lastMessage(discussionId: number): DiscussionMessage | null;
  setSessionId(id: number, claudeSessionId: string): void;
  saveReview(id: number, draft: string, rating: number | null): Discussion;   // also sets status 'reviewed'
  markApplied(id: number): Discussion;                                         // applied_at = now
  delete(id: number): boolean;
}
```
- Table DDL: exactly as in the spec, section 2.

- [ ] **Step 1: Write the failing tests** in `discussions.test.ts` (uses the throwaway test DB from `jest.config.js`):
  - `creates a discussion and lists newest first`: two creates for one book, so `listForBook` returns `[second, first]` with `status: 'active'`.
  - `stores messages in order with role and kind`: add user/chat, assistant/chat, user/review, so `messages` returns that order and `lastMessage` is the review message.
  - `saveReview sets the draft, rating and status`: `saveReview(id, 'Draft', 4.25)` returns `{ reviewDraft: 'Draft', reviewRating: 4.25, status: 'reviewed' }`.
  - `deleting a book cascades to its discussions and messages`: `BookQueries.deleteBook(book.id)`, then `get(id)` is null and `SELECT count(*) FROM discussion_messages` is 0. Ensure `foreign_keys = ON` is in effect; it is set by `connection.ts`.
  - `deleting a discussion leaves the book's review alone`: the book has `personalReview: 'Mine'`; `delete(id)` leaves the book's review as 'Mine'.

- [ ] **Step 2: Run** `./scripts/test.sh -t discussions`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement** `queries/discussions.ts` in the style of `queries/highlights.ts` (prepared statements, snake_case → camelCase aliases in SELECT).

- [ ] **Step 4: Run** `./scripts/test.sh`. Expected: all PASS (the data-safety suite proves the new tables don't disturb existing data on startup).

- [ ] **Step 5: Commit** `git commit -m "Discussion tables and queries"`.

---

### Task 3: Host bridge

**Files:**
- Create: `bridge/cli.mjs` (pure helpers), `bridge/server.mjs` (HTTP server), `bridge/cli.test.mjs`
- Create: `scripts/systemd/claude-bridge.service`
- Modify: `.gitignore` (add `.env.bridge`)

**Interfaces:**
- Produces, in `bridge/cli.mjs`:
  - `buildArgs({ sessionId, resume, systemPrompt, model }) => string[]`: the exact flag list from Global Constraints.
  - `isSessionNotFound(stderrText) => boolean`: true when the text matches `/No conversation found with session ID/`.
- HTTP contract (consumed by Task 4):
  - `POST /turn`, JSON `{ sessionId, resume, systemPrompt, message }`. The response is `200` with `Content-Type: application/x-ndjson`: each CLI stdout JSON line verbatim, then exactly one final bridge line, either `{"type":"bridge_done"}` or `{"type":"bridge_error","code":"session_not_found"|"timeout"|"cli_failed","message":string}`.
  - Before streaming, it may answer `401` (bad token), `400` (bad body) or `409` (`{"error":"busy"}`).
  - `GET /health` returns `{ ok: true, claudeVersion: string }`, where the version comes from `claude --version` cached at startup.

- [ ] **Step 1: Write the failing tests** (`node:test` + `node:assert/strict`):
  - `buildArgs for a new session`: includes `'--session-id', id`, does not include `'--resume'`, includes `'--allowedTools', 'WebSearch,WebFetch'`, `'--tools', 'WebSearch,WebFetch'`, `'--setting-sources', ''`, `'--strict-mcp-config'` and `'--system-prompt', prompt`, and `'--model', 'opus'` when `model` is `'opus'`.
  - `buildArgs for a resume`: includes `'--resume', id` and not `'--session-id'`.
  - `buildArgs never puts the message in argv`: the message isn't a parameter, and no element equals the test message string.
  - `isSessionNotFound`: true for `'No conversation found with session ID: 0000…'`, false for `'Error: rate limited'`.

- [ ] **Step 2: Run** `node --test bridge/`. Expected: FAIL (module not found).

- [ ] **Step 3: Implement `bridge/cli.mjs`**, then `bridge/server.mjs`:
  - Read env (`CLAUDE_BRIDGE_TOKEN` is required, so exit 1 if it's missing; `CLAUDE_BRIDGE_MODEL` defaults to `opus`; `CLAUDE_BIN` defaults to `claude`; `BRIDGE_HOST` defaults to `172.17.0.1`; `BRIDGE_PORT` defaults to `3010`).
  - Compare the token with `crypto.timingSafeEqual`.
  - Spawn with `cwd` set to `~/.local/share/claude-bridge` (`mkdirSync` recursive). Write the message to stdin, then end it.
  - Pipe stdout line by line to the response. Collect stderr.
  - On exit: if the code is 0, send `bridge_done`. Otherwise send `bridge_error`, with code `session_not_found` when `isSessionNotFound(stderr)` matches and `cli_failed` otherwise, and the last 500 characters of stderr as the message.
  - Run a 5-minute `setTimeout` that kills the child with `SIGTERM` and sends `bridge_error timeout`.
  - Kill the child on request `close` before the child exits.
  - A single `busy` flag enforces one turn at a time.
  - `scripts/systemd/claude-bridge.service`: `User=pi`, `EnvironmentFile=/mnt/SSD/projects/personal-reading-tracker/.env.bridge`, `Environment=PATH=/home/pi/.local/bin:/usr/local/bin:/usr/bin:/bin`, `ExecStart=/usr/bin/node /mnt/SSD/projects/personal-reading-tracker/bridge/server.mjs`, `Restart=on-failure`, `After=network-online.target docker.service`, `WantedBy=multi-user.target`.

- [ ] **Step 4: Run** `node --test bridge/`. Expected: PASS. Then smoke-test on the host, with `BRIDGE_HOST=127.0.0.1` and a temporary token, using `CLAUDE_BRIDGE_MODEL=sonnet` to keep usage low:
  - **New session:** `curl -N` a `POST /turn` (`resume: false`). The output ends with `bridge_done`.
  - **Resume:** the same with `resume: true`. Claude recalls the first turn.
  - **Missing session:** `resume: true` with an unknown UUID. The output ends with `bridge_error` `session_not_found`.
  - **Bad token:** returns `401`.
  - **No shell:** a message asking Claude to run `ls` gets a reply saying it has no shell tool.

- [ ] **Step 5: Commit** `git commit -m "claude-bridge: host service running claude -p per turn"`.

---

### Task 4: Bridge client and prompts (backend services)

**Files:**
- Create: `backend/src/services/claudeBridge.ts`, `backend/src/services/discussionPrompts.ts`
- Test: `backend/src/__tests__/discussionPrompts.test.ts`, `backend/src/__tests__/claudeBridge.test.ts`

**Interfaces:**
- Produces, in `claudeBridge.ts`:
```ts
export type TurnEvent =
  | { type: 'status'; text: string }          // e.g. "Searching: <query>" from an assistant tool_use WebSearch/WebFetch
  | { type: 'delta'; text: string }           // stream_event content_block_delta text_delta
  | { type: 'result'; text: string }          // CLI {type:'result', is_error:false}.result
  | { type: 'error'; code: 'session_not_found' | 'timeout' | 'cli_failed' | 'busy' | 'unreachable'; message: string };
export function translateLine(line: unknown): TurnEvent | null;   // one NDJSON object → event or null (ignored kinds)
export interface TurnRequest { sessionId: string; resume: boolean; systemPrompt: string; message: string; }
export interface BridgeClient { runTurn(req: TurnRequest, onEvent: (e: TurnEvent) => void): Promise<void>; health(): Promise<{ ok: boolean; claudeVersion?: string }>; }
export function createBridgeClient(baseUrl = process.env['CLAUDE_BRIDGE_URL'] ?? 'http://172.17.0.1:3010', token = process.env['CLAUDE_BRIDGE_TOKEN'] ?? ''): BridgeClient;
```
  - `translateLine` mapping: `bridge_error` → `error` with the same code. A CLI `result` with `is_error: true` → `error` `cli_failed`. `WebSearch` tool_use → `Searching: ${input.query}`. `WebFetch` → `Reading: ${hostname of input.url}`. Everything else → null.
  - `runTurn` resolves after the stream ends. A `409` is emitted as `error` `busy`; a network failure as `error` `unreachable`. It never throws for bridge-side failures.
- Produces, in `discussionPrompts.ts`:
```ts
export interface PromptBook { title: string; authors: string[]; startedDate?: string | null; completedDate?: string | null; personalRating?: number | null; }
export interface PromptHighlight { quoteText: string; personalNotes?: string | null; }
export interface TranscriptLine { role: 'user' | 'assistant'; content: string; }
export function buildSystemPrompt(book: PromptBook, highlights: PromptHighlight[], voiceExamples: string[], transcript?: TranscriptLine[]): string;
export const KICKOFF_MESSAGE = 'Start the discussion.';
export function buildReviewMessage(instructions?: string): string;
export function parseReview(text: string): { draft: string; rating: number | null };
```
  - The system prompt's content follows spec section 4 (style guide, interview rules, plain prose with no Markdown and no source lists). Highlights are rendered as a numbered list, with notes as `(note: …)`. `personalNotes === 'Imported from Kindle highlights'` is omitted as noise. Voice examples go under the heading `Examples of the reader's own reviews (for voice only, not opinions):`. With a transcript, it adds a `Discussion so far:` section with `Reader:` / `Claude:` lines and the instruction to continue from the last message without re-introducing itself.
  - The review message follows spec section 4 and requires `<review>…</review><rating>N</rating>`. With instructions, it appends `Revise your previous draft with these changes: ${instructions}`.

- [ ] **Step 1: Write the failing tests:**
  - `parseReview takes the last review block and the rating`: `'x <review>old</review> <review>New text</review><rating>4.25</rating>'` → `{ draft: 'New text', rating: 4.25 }`.
  - `parseReview snaps and clamps ratings`: `4.3` → 4.25, `4.4` → 4.5, `6` → 5, `0.5` → 1, `abc` → null, a missing rating → null.
  - `parseReview without tags uses the whole reply, trimmed`.
  - `buildSystemPrompt includes the title, authors, every highlight, notes and voice examples`, and excludes the 'Imported from Kindle highlights' note.
  - `buildSystemPrompt with a transcript adds "Discussion so far" with Reader/Claude lines in order`.
  - `buildReviewMessage includes the instructions when given`.
  - `translateLine` maps:
    - a `text_delta` stream_event → delta;
    - an assistant `tool_use` WebSearch with `{query:'Tolstoy steam engine'}` → `{type:'status', text:'Searching: Tolstoy steam engine'}`;
    - `result` success → result;
    - `{type:'bridge_error', code:'session_not_found'}` → that error;
    - `{type:'system', subtype:'init'}` → null.

- [ ] **Step 2: Run** `./scripts/test.sh -t "discussionPrompts|claudeBridge"`. Expected: FAIL.

- [ ] **Step 3: Implement both modules.** `runTurn` uses Node 20's global `fetch` and reads `response.body` as a stream, split on `\n`.

- [ ] **Step 4: Run** `./scripts/test.sh`. Expected: all PASS.

- [ ] **Step 5: Commit** `git commit -m "Bridge client and discussion prompts"`.

---

### Task 5: Discussion service (orchestration, locking, recovery)

**Files:**
- Create: `backend/src/services/discussions.ts`
- Modify: `backend/src/database/queries/discussions.ts` (add `voiceExamples(excludeBookId: number): string[]`)
- Test: `backend/src/__tests__/discussionService.test.ts`

**Interfaces:**
- Consumes: `DiscussionQueries` (Task 2), `BridgeClient`/`TurnEvent` (Task 4), `buildSystemPrompt`/`KICKOFF_MESSAGE`/`buildReviewMessage`/`parseReview` (Task 4), `BookQueries.getBookById`, `HighlightQueries.getHighlightsByBookId`.
- Produces:
```ts
export class DiscussionError extends Error { constructor(public status: 400 | 404 | 409, message: string) }
export type Emit = (e: TurnEvent | { type: 'done'; message: DiscussionMessage; discussion: Discussion }) => void;
export function createDiscussionService(bridge: BridgeClient, model?: string | null): {
  start(bookId: number, emit: Emit): Promise<Discussion>;             // 409 unless book completed; kickoff turn
  reply(discussionId: number, content: string | null, emit: Emit): Promise<void>; // content null = retry the unanswered user message
  writeReview(discussionId: number, instructions: string | undefined, emit: Emit): Promise<void>;
  saveDraft(discussionId: number, draft: string, rating: number | null): Discussion;
  apply(discussionId: number): Discussion;                            // copies to book personal_review/personal_rating
  isRunning(discussionId: number): boolean;
};
```
- Turn algorithm, run inside every `start` / `reply` / `writeReview`:
  1. If the discussion is already in the running set, throw `DiscussionError(409, 'A reply is already in progress')`, before saving anything.
  2. Add it to the running set (always removed in `finally`).
  3. Save the user message (`kind: 'chat'`, or `'review'` for review turns), unless this is a retry and the last message is an unanswered user message, in which case reuse it.
  4. Build the system prompt from the DB. The voice examples are the two most recently updated non-empty `personal_review` values of **other** books (`ORDER BY updated_at DESC LIMIT 2`, via `DiscussionQueries.voiceExamples(excludeBookId)`).
  5. Call `bridge.runTurn` with `resume: true`, except for the kickoff turn. Forward `status`/`delta` events to `emit` inside `try/catch`, so a throwing emitter (browser gone) never stops the turn.
  6. On `error` `session_not_found`: emit `{type:'status', text:'Reconnecting to the discussion…'}`. Generate a new UUID (`crypto.randomUUID()`) and run again with `resume: false`, the system prompt built **with** the transcript (all messages except the pending one), and the pending message. On success, call `setSessionId`.
  7. On `result`: save the assistant message (`kind` same as the request). For review turns, `parseReview` it and call `saveReview`. Emit `done`.
  8. On any other error: emit it. No assistant message is saved.
- The kickoff turn's user message (`KICKOFF_MESSAGE`) is saved as a `chat` message, and the UI hides it (Task 9).

- [ ] **Step 1: Write the failing tests** with a `FakeBridge` implementing `BridgeClient`. Its constructor takes a scripted list of event arrays per call and records each `TurnRequest`.
  - `start refuses books that are not completed`: rejects with `status: 409`, and no discussion row is created.
  - `start runs a kickoff turn and saves both messages`: the fake emits delta + result `'First question?'`. Messages are `[user 'Start the discussion.', assistant 'First question?']`, and the request has `resume: false` and a system prompt containing the book title.
  - `reply resumes the same session`: the request has `resume: true` and the stored session id.
  - `persists the reply when the listener throws`: the emit callback throws on every call, yet the assistant message is still saved.
  - `rejects a concurrent turn without saving it`: start a `reply` whose fake turn awaits a deferred promise, and call `reply` again. The second rejects with 409; after resolving, there's exactly one new user message.
  - `retry reuses the unanswered user message`: the first `reply('Answer')` gets `error cli_failed`, so there's one user message and no assistant message. Then `reply(id, null)` succeeds: there's still one 'Answer' message, plus the assistant reply.
  - `recovers a lost session by replaying the transcript`:
    - The fake's first call emits `session_not_found`, and the second emits a result.
    - The second request has `resume: false`, a new sessionId, and a system prompt containing `Discussion so far` plus the earlier messages, with the message `'Answer'`.
    - `get(id).claudeSessionId` is the new id.
    - The emitted statuses include 'Reconnecting to the discussion…'.
  - `writeReview parses and stores the draft`: the result `'<review>Great</review><rating>4.25</rating>'` gives `status 'reviewed'`, `reviewDraft 'Great'` and `reviewRating 4.25`, plus messages of kind `review`.
  - `apply copies the draft and rating to the book and stamps applied_at`.

- [ ] **Step 2: Run** `./scripts/test.sh -t discussionService`. Expected: FAIL.

- [ ] **Step 3: Implement** `services/discussions.ts` per the algorithm above.

- [ ] **Step 4: Run** `./scripts/test.sh`. Expected: all PASS.

- [ ] **Step 5: Commit** `git commit -m "Discussion service: turns, locking, retry, session recovery"`.

---

### Task 6: Routes and SSE

**Files:**
- Create: `backend/src/routes/discussions.ts` (exports `bookDiscussionsRouter`, `discussionsRouter`, `claudeRouter`)
- Modify: `backend/src/index.ts` (mount at `/api/books` *before* `booksRouter`, `/api/discussions` and `/api/claude`)
- Test: `backend/src/__tests__/discussionRoutes.test.ts` (schema tests only)

**Interfaces:**
- Consumes: `createDiscussionService` (Task 5), `createBridgeClient` (Task 4), `ratingSchema` (Task 1), and `validateBody`/`validateParams`, following `routes/review.ts`.
- Produces: the endpoints in the spec's route table. Each streaming endpoint (`POST /api/books/:id/discussions`, `POST /api/discussions/:id/messages`, `POST /api/discussions/:id/review`):
  - responds with `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `X-Accel-Buffering: no`, and calls `res.flushHeaders()`;
  - writes `event: <type>\ndata: <json>\n\n` per emitted event, with the `start` endpoint's first event being `event: discussion` with the new discussion (so the client can navigate);
  - ends after `done` or `error`;
  - returns plain JSON `409`/`404` *before* switching to SSE when `DiscussionError` is thrown synchronously at validation. Errors after headers go out as `event: error`.
- Body schemas, exported for tests: `messageBodySchema = z.object({ content: z.string().trim().min(1).max(10000).nullable() })`, `reviewBodySchema = z.object({ instructions: z.string().trim().max(2000).optional() })`, `draftBodySchema = z.object({ draft: z.string().max(10000), rating: ratingSchema.nullable() })`.
- `GET /api/claude/health` returns `bridge.health()`, or `{ ok: false }` on any failure.

- [ ] **Step 1: Write the failing tests:**
  - `draftBodySchema rejects a 4.1 rating and accepts 4.25 and null`.
  - `messageBodySchema accepts null (retry) and rejects an empty string`.

- [ ] **Step 2: Run** `./scripts/test.sh -t discussionRoutes`. Expected: FAIL.

- [ ] **Step 3: Implement** the routes and mount them. Construct the service once at module load with `createBridgeClient()` and `process.env['CLAUDE_BRIDGE_MODEL'] ?? null`.

- [ ] **Step 4: Run** `./scripts/test.sh`. Expected: all PASS. Then a manual check against a local dev server on a copied DB (`DATABASE_PATH=tmp/dev.db`, `CLAUDE_BRIDGE_URL=http://127.0.0.1:3010`, with the bridge from Task 3 running on 127.0.0.1): `curl -N -X POST localhost:<port>/api/books/<completed id>/discussions` streams `discussion`, then `status`/`delta`, then `done`.

- [ ] **Step 5: Commit** `git commit -m "Discussion routes with SSE streaming"`.

---

### Task 7: Quarter-star rating UI

**Files:**
- Create: `frontend/src/components/UI/StarRating.tsx`
- Modify: `frontend/src/components/UI/ProgressTracker.tsx:149-165, 241-260`, `frontend/src/pages/BookDetail.tsx:209-222`, `frontend/src/components/UI/index.ts` (export)

**Interfaces:**
- Produces: `StarRating({ value, onChange?, size? }: { value: number | null; onChange?: (v: number | null) => void; size?: 'sm' | 'md' })`.
  - **Read-only** when `onChange` is absent: five stars, each filled by `clamp(value - (i-1), 0, 1) * 100%` via an overlaid clipped yellow star, followed by `{value}/5`.
  - **Picker** when `onChange` is given: the stars plus a number input (`step 0.25`, `min 1`, `max 5`). Tapping star *i* sets *i*, and a clear button sets null.

- [ ] **Step 1: Implement** `StarRating` and replace the three existing star renderings/pickers with it.
- [ ] **Step 2: Run** the frontend type check (see File Structure). Expected: exit 0.
- [ ] **Step 3: Commit** `git commit -m "Quarter-star rating component"`.

---

### Task 8: Frontend discussions API

**Files:**
- Create: `frontend/src/services/discussionsApi.ts`
- Modify: `frontend/src/types/index.ts` (add `Discussion`, `DiscussionMessage` matching Task 2's interfaces)

**Interfaces:**
- Produces:
```ts
export type StreamEvent =
  | { type: 'discussion'; discussion: Discussion } | { type: 'status'; text: string } | { type: 'delta'; text: string }
  | { type: 'done'; message: DiscussionMessage; discussion: Discussion } | { type: 'error'; code?: string; message: string };
export const discussionsApi: {
  health(): Promise<{ ok: boolean }>;
  list(bookId: number): Promise<Discussion[]>;
  get(id: number): Promise<{ discussion: Discussion; messages: DiscussionMessage[] }>;
  saveDraft(id: number, draft: string, rating: number | null): Promise<Discussion>;
  apply(id: number): Promise<Discussion>;
  remove(id: number): Promise<void>;
  start(bookId: number, onEvent: (e: StreamEvent) => void, signal?: AbortSignal): Promise<void>;
  reply(id: number, content: string | null, onEvent: (e: StreamEvent) => void, signal?: AbortSignal): Promise<void>;
  writeReview(id: number, instructions: string | undefined, onEvent: (e: StreamEvent) => void, signal?: AbortSignal): Promise<void>;
};
```
  - Non-streaming calls use the existing axios instance from `services/api.ts` (export it if needed) **without** the retry wrapper.
  - Streaming calls use `fetch` + `response.body.getReader()`, parsing SSE frames separated by a blank line. A non-2xx response before the stream emits `{type:'error', message: body.error ?? statusText}`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run** the frontend type check. Expected: exit 0.
- [ ] **Step 3: Commit** `git commit -m "Frontend discussions API with SSE reader"`.

---

### Task 9: Discussion page and book page entry point

**Files:**
- Create: `frontend/src/pages/Discussion.tsx`, `frontend/src/components/Discussions/BookDiscussions.tsx`
- Modify: `frontend/src/App.tsx` (route `/books/:id/discuss/:discussionId`), `frontend/src/pages/BookDetail.tsx` (render `<BookDiscussions book={book} />` in the main column after the highlights card, only when `book.status === 'completed'`)

**Interfaces:**
- Consumes: `discussionsApi`, `StreamEvent` (Task 8), `StarRating` (Task 7), and the existing `Button`, `Sheet` and toast context.
- Behaviour, as in spec section 3:
  - **`BookDiscussions`:**
    - Calls `health()`. When it's not ok, the button is disabled and labelled "Claude unavailable".
    - The button reads "Continue discussion" when the newest discussion has `status === 'active'`, and navigates to it.
    - Otherwise, "Discuss with Claude" navigates to `/books/:id/discuss/new`. The `Discussion` page, when `discussionId === 'new'`, calls `start(bookId)`. On the `discussion` event it `navigate(…/discuss/<id>, { replace: true })` without remounting the stream: keep the stream in a ref, keyed by book, not by the URL id.
    - The list shows date, `StarRating` read-only and the draft's first line, plus a delete action with a confirm.
  - **`Discussion` page:**
    - Header: back to the book, the title, and "Write my review" (disabled until there's at least one user message besides the kickoff, and while a turn runs).
    - Messages: the kickoff message (the first user message, content `Start the discussion.`) is hidden. Assistant messages are left, user messages right, `whitespace-pre-wrap`.
    - While streaming, the latest `status` text shows in a muted line and `delta`s append to a provisional bubble, which is replaced by `done.message`.
    - `error` shows an inline banner with Retry (calls `reply(id, null)`, or `writeReview` again for review turns).
    - Textarea: Enter sends unless Shift is held or `matchMedia('(pointer: coarse)')` matches.
    - **Review panel**, shown when `discussion.reviewDraft !== null`:
      - an editable textarea and a `StarRating` picker;
      - "Save draft" (`saveDraft`);
      - "Ask for changes" (a text input → `writeReview(id, instructions)`);
      - "Save as my review": if `book.personalReview` is non-empty, confirm via `Sheet` ("Replace your current review?"), then `apply` and a success toast.

- [ ] **Step 1: Implement** `Discussion.tsx`, `BookDiscussions.tsx` and the wiring.
- [ ] **Step 2: Run** the frontend type check. Expected: exit 0.
- [ ] **Step 3: Commit** `git commit -m "Discussion page and book page entry point"`.

---

### Task 10: Install, preview, deploy, document

**Files:**
- Modify: `CLAUDE.md` (a "Discuss with Claude" section: bridge, env files, `journalctl -u claude-bridge`; remove the backlog entry; Pending deploy updated per step)
- Host only (not committed): `.env.bridge`, `.env.ssd` additions, `/etc/systemd/system/claude-bridge.service`

- [ ] **Step 1: Host setup.**
  - Generate a token with `openssl rand -hex 32`.
  - Write `.env.bridge` (`CLAUDE_BRIDGE_TOKEN=…`, `CLAUDE_BRIDGE_MODEL=opus`).
  - Append `CLAUDE_BRIDGE_URL=http://172.17.0.1:3010` and `CLAUDE_BRIDGE_TOKEN=…` to `.env.ssd`.
  - Copy the unit to `/etc/systemd/system/`, then run `sudo systemctl daemon-reload && sudo systemctl enable --now claude-bridge`.
  - Verify with `curl -s http://172.17.0.1:3010/health`. Expected: `{"ok":true,"claudeVersion":"…"}`.
- [ ] **Step 2: Container reachability:** `docker run --rm --network bridge curlimages/curl -s http://172.17.0.1:3010/health`. Expected: the same JSON. (If the host firewall blocks it, allow `172.17.0.0/16` → `3010` only.)
- [ ] **Step 3: Run** `./scripts/test.sh`. Expected: all PASS.
- [ ] **Step 4: Build and preview:** `docker build -t personal-reading-tracker:$(git rev-parse --short HEAD) .`, then `./scripts/preview.sh start personal-reading-tracker:<sha>`. On :3005 (snapshot DB):
  - the old ratings show unchanged;
  - set a 4.25 rating;
  - run a short full discussion on a completed book: write the review, ask for changes, save it as the review;
  - restart the bridge mid-discussion, then send a message: it continues;
  - stop the bridge: the button shows "Claude unavailable".
  Then `./scripts/preview.sh stop`.
- [ ] **Step 5: Ask the user to confirm the preview, then promote:** `IMAGE=personal-reading-tracker:<sha> ./scripts/redeploy.sh`. Verify `/api/health` and that the live library's ratings are intact (`SELECT count(*), sum(personal_rating) FROM books` is the same before and after).
- [ ] **Step 6: Commit** the CLAUDE.md update, push the branch, and open a PR.
