import './helpers/isolatedDb';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { DiscussionQueries } from '../database/queries/discussions';
import { BridgeClient, TurnEvent, TurnRequest } from '../services/claudeBridge';
import { createDiscussionService, DiscussionError } from '../services/discussions';

type Script = TurnEvent[] | (() => Promise<TurnEvent[]>);

class FakeBridge implements BridgeClient {
    requests: TurnRequest[] = [];
    constructor(private scripts: Script[]) {}
    async runTurn(req: TurnRequest, onEvent: (event: TurnEvent) => void) {
        this.requests.push(req);
        const script = this.scripts.shift() ?? [];
        const events = typeof script === 'function' ? await script() : script;
        for (const event of events) onEvent(event);
    }
    async health() { return { ok: true }; }
}

const result = (text: string): TurnEvent[] => [{ type: 'delta', text }, { type: 'result', text }];
const noop = () => {};
let counter = 0;

function makeBook(status: 'completed' | 'in_progress' = 'completed') {
    counter += 1;
    const book = BookQueries.createBook({ title: `Book ${counter}`, authors: ['Author'], position: counter });
    return BookQueries.updateBook(book.id, { status, progressPercentage: status === 'completed' ? 100 : 40 })!;
}

async function startedDiscussion(bridge: FakeBridge) {
    const book = makeBook();
    const service = createDiscussionService(bridge, 'opus');
    const discussion = await service.start(book.id, noop);
    return { book, service, discussion };
}

describe('discussion service', () => {
    it('start refuses books that are not completed', async () => {
        const book = makeBook('in_progress');
        const service = createDiscussionService(new FakeBridge([]), null);

        await expect(service.start(book.id, noop)).rejects.toMatchObject({ status: 409 });
        expect(DiscussionQueries.listForBook(book.id)).toEqual([]);
    });

    it('start runs a kickoff turn and saves both messages', async () => {
        const bridge = new FakeBridge([result('First question?')]);
        const { book, discussion } = await startedDiscussion(bridge);

        expect(DiscussionQueries.messages(discussion.id).map(m => [m.role, m.content]))
            .toEqual([['user', 'Start the discussion.'], ['assistant', 'First question?']]);
        expect(bridge.requests[0]).toMatchObject({ resume: false, sessionId: discussion.claudeSessionId, message: 'Start the discussion.' });
        expect(bridge.requests[0]!.systemPrompt).toContain(book.title);
    });

    it('includes the book highlights and other books\' reviews in the system prompt', async () => {
        const other = makeBook();
        BookQueries.updateBook(other.id, { personalReview: 'My voice sample review.' });
        const book = makeBook();
        HighlightQueries.createHighlight(book.id, { quoteText: 'A memorable highlighted passage.' });
        const bridge = new FakeBridge([result('Q?')]);

        await createDiscussionService(bridge, null).start(book.id, noop);

        expect(bridge.requests[0]!.systemPrompt).toContain('A memorable highlighted passage.');
        expect(bridge.requests[0]!.systemPrompt).toContain('My voice sample review.');
    });

    it('reply resumes the same session', async () => {
        const bridge = new FakeBridge([result('Q1?'), result('Q2?')]);
        const { service, discussion } = await startedDiscussion(bridge);

        await service.reply(discussion.id, 'My answer', noop);

        expect(bridge.requests[1]).toMatchObject({ resume: true, sessionId: discussion.claudeSessionId, message: 'My answer' });
        expect(DiscussionQueries.lastMessage(discussion.id)).toMatchObject({ role: 'assistant', content: 'Q2?' });
    });

    it('persists the reply when the listener throws', async () => {
        const bridge = new FakeBridge([result('Q1?'), result('Q2?')]);
        const { service, discussion } = await startedDiscussion(bridge);

        await service.reply(discussion.id, 'Answer', () => { throw new Error('browser gone'); });

        expect(DiscussionQueries.lastMessage(discussion.id)).toMatchObject({ role: 'assistant', content: 'Q2?' });
    });

    it('rejects a concurrent turn without saving it', async () => {
        let release!: () => void;
        const gate = new Promise<void>(resolve => { release = resolve; });
        const bridge = new FakeBridge([result('Q1?'), async () => { await gate; return result('Q2?'); }]);
        const { service, discussion } = await startedDiscussion(bridge);

        const first = service.reply(discussion.id, 'First', noop);
        expect(service.isRunning(discussion.id)).toBe(true);
        await expect(service.reply(discussion.id, 'Second', noop)).rejects.toMatchObject({ status: 409 });
        release();
        await first;

        const userMessages = DiscussionQueries.messages(discussion.id).filter(m => m.role === 'user').map(m => m.content);
        expect(userMessages).toEqual(['Start the discussion.', 'First']);
        expect(service.isRunning(discussion.id)).toBe(false);
    });

    it('retry reuses the unanswered user message', async () => {
        const bridge = new FakeBridge([
            result('Q1?'),
            [{ type: 'error', code: 'cli_failed', message: 'boom' }],
            result('Q2?')
        ]);
        const { service, discussion } = await startedDiscussion(bridge);
        const events: TurnEvent[] = [];

        await service.reply(discussion.id, 'Answer', event => events.push(event as TurnEvent));
        expect(events).toContainEqual({ type: 'error', code: 'cli_failed', message: 'boom' });
        expect(DiscussionQueries.lastMessage(discussion.id)).toMatchObject({ role: 'user', content: 'Answer' });

        await service.reply(discussion.id, null, noop);

        expect(DiscussionQueries.messages(discussion.id).map(m => m.content))
            .toEqual(['Start the discussion.', 'Q1?', 'Answer', 'Q2?']);
        expect(bridge.requests[2]!.message).toBe('Answer');
    });

    it('rejects a retry when there is no unanswered message', async () => {
        const { service, discussion } = await startedDiscussion(new FakeBridge([result('Q1?')]));
        await expect(service.reply(discussion.id, null, noop)).rejects.toMatchObject({ status: 400 });
    });

    it('recovers a lost session by replaying the transcript', async () => {
        const bridge = new FakeBridge([
            result('What did you make of Pierre?'),
            [{ type: 'error', code: 'session_not_found', message: 'No conversation found' }],
            result('Q2?')
        ]);
        const { service, discussion } = await startedDiscussion(bridge);
        const statuses: string[] = [];

        await service.reply(discussion.id, 'He grows on you.', event => {
            if (event.type === 'status') statuses.push(event.text);
        });

        const replay = bridge.requests[2]!;
        expect(replay.resume).toBe(false);
        expect(replay.sessionId).not.toBe(discussion.claudeSessionId);
        expect(replay.message).toBe('He grows on you.');
        expect(replay.systemPrompt).toContain('Discussion so far');
        expect(replay.systemPrompt).toContain('Claude: What did you make of Pierre?');
        expect(replay.systemPrompt).not.toContain('Reader: He grows on you.');
        expect(DiscussionQueries.get(discussion.id)!.claudeSessionId).toBe(replay.sessionId);
        expect(statuses).toContain('Reconnecting to the discussion…');
        expect(DiscussionQueries.messages(discussion.id).filter(m => m.content === 'He grows on you.')).toHaveLength(1);
        expect(DiscussionQueries.lastMessage(discussion.id)).toMatchObject({ role: 'assistant', content: 'Q2?' });
    });

    it('writeReview parses and stores the draft', async () => {
        const bridge = new FakeBridge([result('Q1?'), result('<review>Great</review><rating>4.25</rating>')]);
        const { service, discussion } = await startedDiscussion(bridge);

        await service.writeReview(discussion.id, undefined, noop);

        expect(DiscussionQueries.get(discussion.id)).toMatchObject({ status: 'reviewed', reviewDraft: 'Great', reviewRating: 4.25 });
        expect(DiscussionQueries.messages(discussion.id).slice(-2).map(m => [m.role, m.kind]))
            .toEqual([['user', 'review'], ['assistant', 'review']]);
    });

    it('apply copies the draft and rating to the book and stamps applied_at', async () => {
        const { book, service, discussion } = await startedDiscussion(new FakeBridge([result('Q1?')]));
        service.saveDraft(discussion.id, 'My edited review', 4.75);

        const applied = service.apply(discussion.id);

        expect(applied.appliedAt).toEqual(expect.any(String));
        expect(BookQueries.getBookById(book.id)).toMatchObject({ personalReview: 'My edited review', personalRating: 4.75 });
    });

    it('apply refuses a discussion without a draft', async () => {
        const { service, discussion } = await startedDiscussion(new FakeBridge([result('Q1?')]));
        expect(() => service.apply(discussion.id)).toThrow(DiscussionError);
    });

    it('unknown discussions are 404', async () => {
        const service = createDiscussionService(new FakeBridge([]), null);
        await expect(service.reply(999999, 'x', noop)).rejects.toMatchObject({ status: 404 });
    });
});
