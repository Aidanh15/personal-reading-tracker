import './helpers/isolatedDb';
import { BookQueries } from '../database/queries/books';
import { DiscussionQueries } from '../database/queries/discussions';
import { db } from '../database/connection';

function completedBook(title: string) {
    const book = BookQueries.createBook({ title, authors: ['Some Author'], position: 1 });
    return BookQueries.updateBook(book.id, { status: 'completed', progressPercentage: 100 })!;
}

describe('discussion queries', () => {
    it('creates a discussion and lists newest first', () => {
        const book = completedBook('War and Peace');
        const first = DiscussionQueries.create(book.id, 'session-1', 'opus');
        const second = DiscussionQueries.create(book.id, 'session-2', 'opus');

        expect(first).toMatchObject({ bookId: book.id, claudeSessionId: 'session-1', status: 'active', model: 'opus', reviewDraft: null });
        expect(DiscussionQueries.listForBook(book.id).map(d => d.id)).toEqual([second.id, first.id]);
    });

    it('stores messages in order with role and kind', () => {
        const book = completedBook('Demons');
        const discussion = DiscussionQueries.create(book.id, 'session-3', null);
        DiscussionQueries.addMessage(discussion.id, 'user', 'chat', 'Start the discussion.');
        DiscussionQueries.addMessage(discussion.id, 'assistant', 'chat', 'First question?');
        const review = DiscussionQueries.addMessage(discussion.id, 'user', 'review', 'Write the review.');

        expect(DiscussionQueries.messages(discussion.id).map(m => [m.role, m.kind, m.content])).toEqual([
            ['user', 'chat', 'Start the discussion.'],
            ['assistant', 'chat', 'First question?'],
            ['user', 'review', 'Write the review.']
        ]);
        expect(DiscussionQueries.lastMessage(discussion.id)).toEqual(review);
    });

    it('saveReview sets the draft, rating and status', () => {
        const book = completedBook('Nausea');
        const discussion = DiscussionQueries.create(book.id, 'session-4', null);

        expect(DiscussionQueries.saveReview(discussion.id, 'Draft', 4.25))
            .toMatchObject({ reviewDraft: 'Draft', reviewRating: 4.25, status: 'reviewed' });
    });

    it('updates the session id and marks a review applied', () => {
        const book = completedBook('The Trial');
        const discussion = DiscussionQueries.create(book.id, 'session-5', null);
        DiscussionQueries.setSessionId(discussion.id, 'session-5b');

        expect(DiscussionQueries.get(discussion.id)!.claudeSessionId).toBe('session-5b');
        expect(DiscussionQueries.markApplied(discussion.id).appliedAt).toEqual(expect.any(String));
    });

    it('deleting a book cascades to its discussions and messages', () => {
        const book = completedBook('The Plague');
        const discussion = DiscussionQueries.create(book.id, 'session-6', null);
        DiscussionQueries.addMessage(discussion.id, 'user', 'chat', 'Hello');

        BookQueries.deleteBook(book.id);

        expect(DiscussionQueries.get(discussion.id)).toBeNull();
        expect(db.prepare('SELECT count(*) AS n FROM discussion_messages WHERE discussion_id = ?').get(discussion.id)).toEqual({ n: 0 });
    });

    it("deleting a discussion leaves the book's review alone", () => {
        const book = completedBook('The Rebel');
        BookQueries.updateBook(book.id, { personalReview: 'Mine' });
        const discussion = DiscussionQueries.create(book.id, 'session-7', null);

        expect(DiscussionQueries.delete(discussion.id)).toBe(true);
        expect(BookQueries.getBookById(book.id)!.personalReview).toBe('Mine');
    });
});
