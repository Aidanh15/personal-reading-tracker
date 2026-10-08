import { db } from './connection';
import { Book } from '../types';

/**
 * Library maintenance helpers: strict title matching and loss-free merging of
 * duplicate books/highlights. Merges never drop a highlight's text, notes or
 * review state; duplicates are collapsed onto the copy that is kept.
 */

export function normalizeTitle(title: string): string {
    return title
        .normalize('NFKD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/\([^)]*\)/g, ' ')
        .replace(/&/g, ' and ')
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/** Title before any subtitle, e.g. "Stoner, A Novel" -> "stoner". */
function mainTitle(title: string): string {
    return normalizeTitle(title.replace(/\([^)]*\)/g, ' ').split(/[:,;]/)[0] ?? title);
}

function surname(author: string): string {
    const words = normalizeTitle(author).split(' ').filter(Boolean);
    return words[words.length - 1] ?? '';
}

export function authorsOverlap(a: string[], b: string[]): boolean {
    const surnames = new Set(a.map(surname).filter(Boolean));
    return b.some(author => surnames.has(surname(author)));
}

/**
 * Finds the one book a title refers to. Matches whole titles, or a main title
 * against a whole/main title (so "Stoner, A Novel (Vintage Classics)" finds
 * "Stoner"), never partial words ("The Road" is not "The Road to Los Angeles").
 * Authors break ties; anything still ambiguous returns undefined.
 */
export function findBookByTitle(title: string, authors: string[], books: Book[]): Book | undefined {
    const full = normalizeTitle(title);
    const main = mainTitle(title);
    const knownAuthors = authors.filter(author => normalizeTitle(author) !== 'unknown');

    let candidates = books.filter(book => normalizeTitle(book.title) === full);
    if (candidates.length === 0) {
        candidates = books.filter(book =>
            normalizeTitle(book.title) === main || mainTitle(book.title) === main
        );
    }

    if (candidates.length > 1 && knownAuthors.length > 0) {
        const byAuthor = candidates.filter(book => authorsOverlap(book.authors, knownAuthors));
        if (byAuthor.length > 0) candidates = byAuthor;
    }

    if (candidates.length === 1) {
        const [book] = candidates;
        if (knownAuthors.length > 0 && !book!.authors.some(a => normalizeTitle(a) === 'unknown') &&
            !authorsOverlap(book!.authors, knownAuthors) && normalizeTitle(book!.title) !== full) {
            return undefined;
        }
        return book;
    }

    return undefined;
}

interface ReviewRow {
    highlight_id: number;
    last_reviewed_at: string | null;
    next_review_at: string | null;
    review_count: number;
    favorite: number;
    archived: number;
}

/** Keeps the richer review history of two copies of the same highlight on `keepId`. */
function combineReviewState(dropId: number, keepId: number): void {
    const get = db.prepare('SELECT * FROM highlight_reviews WHERE highlight_id = ?');
    const dropped = get.get(dropId) as ReviewRow | undefined;
    if (!dropped) return;

    const kept = get.get(keepId) as ReviewRow | undefined;
    if (!kept) {
        db.prepare('UPDATE highlight_reviews SET highlight_id = ? WHERE highlight_id = ?').run(keepId, dropId);
        return;
    }

    const newest = (dropped.last_reviewed_at ?? '') > (kept.last_reviewed_at ?? '') ? dropped : kept;
    db.prepare(`
        UPDATE highlight_reviews
        SET review_count = ?, favorite = ?, archived = ?, last_reviewed_at = ?, next_review_at = ?
        WHERE highlight_id = ?
    `).run(
        Math.max(kept.review_count, dropped.review_count),
        Math.max(kept.favorite, dropped.favorite),
        newest.archived,
        newest.last_reviewed_at,
        newest.next_review_at,
        keepId
    );
}

/**
 * Removes highlights on `fromBookId` whose exact text already exists on
 * `keepOnBookId`, carrying their review state across first. Returns how many
 * were removed.
 */
export function removeHighlightsDuplicatedOn(fromBookId: number, keepOnBookId: number): number {
    const duplicates = db.prepare(`
        SELECT dup.id AS dropId, keep.id AS keepId
        FROM highlights dup
        JOIN highlights keep ON keep.quote_text = dup.quote_text AND keep.book_id = ?
        WHERE dup.book_id = ?
    `).all(keepOnBookId, fromBookId) as { dropId: number; keepId: number }[];

    for (const { dropId, keepId } of duplicates) {
        combineReviewState(dropId, keepId);
        db.prepare('DELETE FROM highlights WHERE id = ?').run(dropId);
    }

    return duplicates.length;
}

/**
 * Merges `sourceId` into `targetId` and deletes the source book. Highlights the
 * target lacks are moved; duplicates are collapsed keeping review state.
 * The target's status/progress win; the source only fills missing details.
 */
export function mergeBooks(sourceId: number, targetId: number): { moved: number; collapsed: number } {
    if (sourceId === targetId) return { moved: 0, collapsed: 0 };

    const collapsed = removeHighlightsDuplicatedOn(sourceId, targetId);
    const moved = db.prepare('UPDATE highlights SET book_id = ? WHERE book_id = ?').run(targetId, sourceId).changes;
    db.prepare('UPDATE reading_sessions SET book_id = ? WHERE book_id = ?').run(targetId, sourceId);
    db.prepare(`
        UPDATE books SET
            cover_image_url = COALESCE(cover_image_url, (SELECT cover_image_url FROM books WHERE id = ?)),
            total_pages = COALESCE(total_pages, (SELECT total_pages FROM books WHERE id = ?)),
            personal_rating = COALESCE(personal_rating, (SELECT personal_rating FROM books WHERE id = ?)),
            personal_review = COALESCE(personal_review, (SELECT personal_review FROM books WHERE id = ?))
        WHERE id = ?
    `).run(sourceId, sourceId, sourceId, sourceId, targetId);
    db.prepare('DELETE FROM books WHERE id = ?').run(sourceId);

    return { moved, collapsed };
}
