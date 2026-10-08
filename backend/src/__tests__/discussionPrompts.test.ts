import { buildReviewMessage, buildSystemPrompt, KICKOFF_MESSAGE, parseReview } from '../services/discussionPrompts';

const book = { title: 'War and Peace', authors: ['Leo Tolstoy'], completedDate: '2026-09-01T00:00:00.000Z', personalRating: null };

describe('parseReview', () => {
    it('takes the last review block and the rating', () => {
        expect(parseReview('x <review>old</review> <review>New text</review><rating>4.25</rating>'))
            .toEqual({ draft: 'New text', rating: 4.25 });
    });

    it('snaps ratings to quarter stars and clamps them to 1-5', () => {
        const rating = (value: string) => parseReview(`<review>R</review><rating>${value}</rating>`).rating;
        expect(rating('4.3')).toBe(4.25);
        expect(rating('4.4')).toBe(4.5);
        expect(rating('6')).toBe(5);
        expect(rating('0.5')).toBe(1);
        expect(rating('abc')).toBeNull();
        expect(parseReview('<review>R</review>').rating).toBeNull();
    });

    it('uses the whole reply, trimmed, when there are no review tags', () => {
        expect(parseReview('  Just a review.\n')).toEqual({ draft: 'Just a review.', rating: null });
    });
});

describe('buildSystemPrompt', () => {
    const highlights = [
        { quoteText: 'Pierre highlight', personalNotes: 'Loved this' },
        { quoteText: 'Napoleon highlight', personalNotes: 'Imported from Kindle highlights' }
    ];

    it('includes the book, every highlight with real notes, and the voice examples', () => {
        const prompt = buildSystemPrompt(book, highlights, ['An earlier review of mine.']);
        expect(prompt).toContain('War and Peace');
        expect(prompt).toContain('Leo Tolstoy');
        expect(prompt).toContain('Pierre highlight');
        expect(prompt).toContain('Napoleon highlight');
        expect(prompt).toContain('Loved this');
        expect(prompt).not.toContain('Imported from Kindle highlights');
        expect(prompt).toContain('An earlier review of mine.');
        expect(prompt).not.toContain('Discussion so far');
    });

    it('adds the discussion so far, in order, when replaying a transcript', () => {
        const prompt = buildSystemPrompt(book, highlights, [], [
            { role: 'assistant', content: 'What did you make of Pierre?' },
            { role: 'user', content: 'He grows on you.' }
        ]);
        const so_far = prompt.indexOf('Discussion so far');
        expect(so_far).toBeGreaterThan(-1);
        expect(prompt.indexOf('Claude: What did you make of Pierre?')).toBeGreaterThan(so_far);
        expect(prompt.indexOf('Reader: He grows on you.')).toBeGreaterThan(prompt.indexOf('Claude: What did you make of Pierre?'));
    });
});

describe('review faithfulness rules', () => {
    it("tells Claude that its own questions and suggestions are not the reader's views", () => {
        const prompt = buildSystemPrompt(book, [], []);
        expect(prompt).toMatch(/your own questions, suggestions and interpretations are not the reader's views/i);
        expect(buildReviewMessage()).toMatch(/only what I actually said or clearly agreed with/i);
    });

    it('asks for a standalone review that never mentions the discussion', () => {
        expect(buildSystemPrompt(book, [], [])).toMatch(/never mention this discussion/i);
    });
});

describe('turn messages', () => {
    it('kicks off with a fixed message', () => {
        expect(KICKOFF_MESSAGE).toBe('Start the discussion.');
    });

    it('asks for the tagged review format, with change instructions when given', () => {
        expect(buildReviewMessage()).toContain('<review>');
        expect(buildReviewMessage()).toContain('<rating>');
        expect(buildReviewMessage('make it shorter')).toContain('make it shorter');
    });
});
