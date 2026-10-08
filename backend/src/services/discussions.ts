import { randomUUID } from 'crypto';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { Discussion, DiscussionMessage, DiscussionQueries, MessageKind } from '../database/queries/discussions';
import { BridgeClient, TurnEvent, TurnRequest } from './claudeBridge';
import { buildReviewMessage, buildSystemPrompt, KICKOFF_MESSAGE, parseReview, TranscriptLine } from './discussionPrompts';

export class DiscussionError extends Error {
    constructor(public status: 400 | 404 | 409, message: string) {
        super(message);
    }
}

export type Emit = (event:
    | TurnEvent
    | { type: 'discussion'; discussion: Discussion }
    | { type: 'done'; message: DiscussionMessage; discussion: Discussion }
) => void;

/**
 * Runs "Discuss with Claude": one turn at a time per discussion, every message
 * saved in the app database, and lost Claude sessions recovered by replaying
 * the saved transcript into a new one.
 */
export function createDiscussionService(bridge: BridgeClient, model: string | null = null) {
    const running = new Set<number>();

    function load(id: number): Discussion {
        const discussion = DiscussionQueries.get(id);
        if (!discussion) throw new DiscussionError(404, 'Discussion not found');
        return discussion;
    }

    function systemPrompt(discussion: Discussion, transcript?: TranscriptLine[]): string {
        const book = BookQueries.getBookById(discussion.bookId);
        if (!book) throw new DiscussionError(404, 'Book not found');
        const highlights = HighlightQueries.getHighlightsByBookId(book.id);
        return buildSystemPrompt(book, highlights, DiscussionQueries.voiceExamples(book.id), transcript);
    }

    /** One bridge call; never throws for bridge-side failures. */
    async function call(req: TurnRequest, emit: Emit): Promise<{ text: string | null; error: Extract<TurnEvent, { type: 'error' }> | null }> {
        let text: string | null = null;
        let error: Extract<TurnEvent, { type: 'error' }> | null = null;
        await bridge.runTurn(req, event => {
            if (event.type === 'result') text = event.text;
            else if (event.type === 'error') error = event;
            else emit(event);
        });
        return { text, error };
    }

    /**
     * The shared turn: saves the reader's message (or reuses the unanswered one
     * when `content` is null), asks Claude, and saves the reply. Errors are
     * emitted, not thrown, once the turn has started.
     */
    async function turn(discussionId: number, kind: MessageKind, content: string | null, resume: boolean, rawEmit: Emit): Promise<void> {
        const discussion = load(discussionId);
        if (running.has(discussionId)) throw new DiscussionError(409, 'A reply is already in progress');
        running.add(discussionId);

        // The browser may be gone; that must never stop the turn from being saved.
        const emit: Emit = event => {
            try {
                rawEmit(event);
            } catch {
                // ignore
            }
        };

        try {
            let pending: DiscussionMessage;
            // Answers saved after Claude's last reply that it never received (a
            // failed turn the reader didn't retry): send them along so Claude sees them.
            const unanswered: string[] = [];
            for (const message of [...DiscussionQueries.messages(discussionId)].reverse()) {
                if (message.role !== 'user') break;
                if (message.kind === 'chat') unanswered.unshift(message.content);
            }
            if (content === null) {
                const last = DiscussionQueries.lastMessage(discussionId);
                if (!last || last.role !== 'user') throw new DiscussionError(400, 'Nothing to retry');
                pending = last;
                // the retried message itself is sent as `pending`
                if (last.kind === 'chat') unanswered.pop();
            } else {
                pending = DiscussionQueries.addMessage(discussionId, 'user', kind, content);
            }

            const outgoing = [...unanswered, pending.content].join('\n\n');
            let outcome = await call({
                sessionId: discussion.claudeSessionId,
                resume,
                systemPrompt: systemPrompt(discussion),
                message: outgoing
            }, emit);

            if (outcome.error?.code === 'session_not_found') {
                emit({ type: 'status', text: 'Reconnecting to the discussion…' });
                const transcript = DiscussionQueries.messages(discussionId)
                    .filter(message => message.id !== pending.id && !(message.role === 'user' && unanswered.includes(message.content)))
                    .map(message => ({ role: message.role, content: message.content }));
                const sessionId = randomUUID();
                outcome = await call({
                    sessionId,
                    resume: false,
                    systemPrompt: systemPrompt(discussion, transcript),
                    message: outgoing
                }, emit);
                if (outcome.text !== null) DiscussionQueries.setSessionId(discussionId, sessionId);
            }

            if (outcome.text === null) {
                emit(outcome.error ?? { type: 'error', code: 'cli_failed', message: 'Claude did not reply' });
                return;
            }

            const message = DiscussionQueries.addMessage(discussionId, 'assistant', pending.kind, outcome.text);
            // A review Claude wrote in the chat (the reader said yes to its offer) counts too
            if (pending.kind === 'review' || outcome.text.includes('<review>')) {
                const review = parseReview(outcome.text);
                DiscussionQueries.saveReview(discussionId, review.draft, review.rating);
            }
            emit({ type: 'done', message, discussion: load(discussionId) });
        } finally {
            running.delete(discussionId);
        }
    }

    return {
        async start(bookId: number, emit: Emit): Promise<Discussion> {
            const book = BookQueries.getBookById(bookId);
            if (!book) throw new DiscussionError(404, 'Book not found');
            if (book.status !== 'completed') throw new DiscussionError(409, 'Discussions are for finished books');

            const discussion = DiscussionQueries.create(bookId, randomUUID(), model);
            emit({ type: 'discussion', discussion });
            await turn(discussion.id, 'chat', KICKOFF_MESSAGE, false, emit);
            return load(discussion.id);
        },

        reply(discussionId: number, content: string | null, emit: Emit): Promise<void> {
            return turn(discussionId, 'chat', content, true, emit);
        },

        writeReview(discussionId: number, instructions: string | undefined, emit: Emit): Promise<void> {
            return turn(discussionId, 'review', buildReviewMessage(instructions), true, emit);
        },

        saveDraft(discussionId: number, draft: string, rating: number | null): Discussion {
            load(discussionId);
            return DiscussionQueries.saveReview(discussionId, draft, rating);
        },

        /** Copies the draft to the book. A different existing review is only replaced with confirmReplace. */
        apply(discussionId: number, confirmReplace = false): Discussion {
            const discussion = load(discussionId);
            if (discussion.reviewDraft === null) throw new DiscussionError(400, 'There is no review draft yet');
            const current = BookQueries.getBookById(discussion.bookId)?.personalReview?.trim();
            if (current && current !== discussion.reviewDraft.trim() && !confirmReplace) {
                throw new DiscussionError(409, 'This book already has a different review');
            }
            BookQueries.updateBook(discussion.bookId, {
                personalReview: discussion.reviewDraft,
                ...(discussion.reviewRating !== null && { personalRating: discussion.reviewRating })
            });
            return DiscussionQueries.markApplied(discussionId);
        },

        isRunning(discussionId: number): boolean {
            return running.has(discussionId);
        }
    };
}

export type DiscussionService = ReturnType<typeof createDiscussionService>;
