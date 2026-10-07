/**
 * Guards the reader's saved data against the code that runs on every deploy:
 * the container entrypoint (seed-user-data, sync-reading-plan), Kindle imports,
 * and the schema upgrade in the DB connection. None of these may lose or
 * change progress, ratings, reviews, highlights or review state.
 */
import Database from 'better-sqlite3';
import { mkdtempSync, readFileSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseSeeder } from '../database/seed';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { db } from '../database/connection';
import { Book } from '../types';

const workDir = mkdtempSync(join(tmpdir(), 'reading-tracker-fixtures-'));

function addBook(title: string, author: string, position: number, progress: Partial<Book> = {}): Book {
    const book = BookQueries.createBook({ title, authors: [author], position });
    return Object.keys(progress).length ? BookQueries.updateBook(book.id, progress)! : book;
}

/** Builds a small library that looks like real use: every kind of saved state. */
function seedLibrary() {
    const deadSouls = addBook('Dead Souls', 'Nikolai Gogol', 19, {
        status: 'in_progress', progressPercentage: 37, currentPage: 120, totalPages: 400,
        startedDate: '2026-09-01T08:00:00.000Z'
    });
    const demons = addBook('Demons', 'Fyodor Dostoevsky', 20, {
        status: 'did_not_finish', progressPercentage: 20, currentPage: 80, totalPages: 700,
        startedDate: '2026-05-01T08:00:00.000Z', personalReview: 'Not for me right now.'
    });
    const invisibleCities = addBook('Invisible Cities', 'Italo Calvino', 21, {
        status: 'completed', progressPercentage: 100, currentPage: 165, totalPages: 165,
        startedDate: '2026-03-01T08:00:00.000Z', completedDate: '2026-03-20T08:00:00.000Z',
        personalRating: 5, personalReview: 'Beautiful.'
    });
    addBook('Fragments', 'Heraclitus', 17);
    // Re-reads and abandoned books that have Kindle metadata overrides
    addBook('War and Peace', 'Leo Tolstoy', 2, {
        status: 'in_progress', progressPercentage: 55, currentPage: 700, totalPages: 1300,
        startedDate: '2026-08-01T08:00:00.000Z'
    });
    addBook('Slaughterhouse-Five', 'Kurt Vonnegut', 3, {
        status: 'did_not_finish', progressPercentage: 30, currentPage: 60, totalPages: 200
    });
    // Not on the master plan: gets moved down the list, but must keep its progress
    addBook('Some Unlisted Novel', 'Jane Writer', 40, {
        status: 'in_progress', progressPercentage: 10, currentPage: 25, totalPages: 250
    });

    const h1 = HighlightQueries.createHighlight(deadSouls.id, {
        quoteText: 'A highlight from Dead Souls that I want to keep forever.',
        personalNotes: 'My own note about this passage.', pageNumber: 42
    });
    const h2 = HighlightQueries.createHighlight(invisibleCities.id, {
        quoteText: 'Cities like dreams are made of desires and fears.',
        personalNotes: 'Favourite line.'
    });
    HighlightQueries.createHighlight(demons.id, { quoteText: 'A passage from Demons worth remembering.' });

    const review = db.prepare(`
        INSERT INTO highlight_reviews (highlight_id, last_reviewed_at, next_review_at, review_count, favorite, archived)
        VALUES (?, ?, ?, ?, ?, ?)
    `);
    review.run(h1.id, '2026-10-01T08:00:00.000Z', '2026-10-15T08:00:00.000Z', 4, 1, 0);
    review.run(h2.id, '2026-09-01T08:00:00.000Z', '2026-12-01T08:00:00.000Z', 2, 0, 1);

    db.prepare(`
        INSERT INTO reading_sessions (book_id, start_time, end_time, pages_read, notes)
        VALUES (?, ?, ?, ?, ?)
    `).run(deadSouls.id, '2026-10-01T20:00:00.000Z', '2026-10-01T21:00:00.000Z', 30, 'Good session');
}

/** Everything the reader has saved, keyed by id. Excludes fields the sync is allowed to rewrite. */
function savedState() {
    return {
        books: db.prepare(`
            SELECT id, status, progress_percentage, total_pages, current_page, started_date,
                   completed_date, personal_rating, personal_review, cover_image_url
            FROM books ORDER BY id
        `).all(),
        highlights: db.prepare(`
            SELECT id, book_id, quote_text, page_number, location, personal_notes, highlight_date
            FROM highlights ORDER BY id
        `).all(),
        reviews: db.prepare(`
            SELECT highlight_id, last_reviewed_at, next_review_at, review_count, favorite, archived
            FROM highlight_reviews ORDER BY highlight_id
        `).all(),
        sessions: db.prepare('SELECT * FROM reading_sessions ORDER BY id').all()
    };
}

/** The sync may add missing plan books; everything that existed before must be untouched. */
function expectPreserved(before: ReturnType<typeof savedState>) {
    const after = savedState();
    const beforeIds = new Set(before.books.map((book: any) => book.id));
    expect(after.books.filter((book: any) => beforeIds.has(book.id))).toEqual(before.books);
    expect(after.highlights).toEqual(before.highlights);
    expect(after.reviews).toEqual(before.reviews);
    expect(after.sessions).toEqual(before.sessions);
}

/** Same steps as scripts/docker-entrypoint.sh. */
async function runStartup() {
    await DatabaseSeeder.seedWithUserData(join(workDir, 'missing-kindle.txt'), join(workDir, 'missing-list.txt'));
    DatabaseSeeder.syncMasterReadingPlan();
}

function bookStatus(title: string) {
    return BookQueries.getAllBooks().find(book => book.title === title)!;
}

beforeEach(() => {
    db.exec('DELETE FROM daily_review_queue; DELETE FROM highlight_reviews;');
    DatabaseSeeder.clearDatabase();
    seedLibrary();
});

describe('deploy startup (seed + reading plan sync)', () => {
    it('keeps all saved progress, highlights and review state, across repeated deploys', async () => {
        const before = savedState();

        await runStartup();
        expectPreserved(before);
        const afterFirstDeploy = savedState();

        await runStartup();
        expect(savedState()).toEqual(afterFirstDeploy);
    });

    it('does not re-complete a book with a Kindle override once the reader has changed it', async () => {
        await runStartup();

        expect(bookStatus('War and Peace')).toMatchObject({ status: 'in_progress', progressPercentage: 55 });
        expect(bookStatus('Slaughterhouse-Five')).toMatchObject({ status: 'did_not_finish', progressPercentage: 30 });
    });

    it('still marks an untouched Kindle-imported override book as completed', async () => {
        DatabaseSeeder.clearDatabase();
        addBook('War And Peace', 'Unknown', 5);

        await runStartup();

        expect(bookStatus('War and Peace')).toMatchObject({ status: 'completed', progressPercentage: 100 });
    });

    it('keeps unlisted books in the library with their progress', async () => {
        await runStartup();

        const unlisted = bookStatus('Some Unlisted Novel');
        expect(unlisted).toMatchObject({ status: 'in_progress', progressPercentage: 10, currentPage: 25 });
        expect(unlisted.position).toBeGreaterThanOrEqual(1000);
    });
});

describe('Kindle import into an existing library', () => {
    it('adds new highlights without duplicating or changing existing ones', () => {
        const before = savedState();
        const bookCount = before.books.length;

        const kindleFile = join(workDir, 'kindle.txt');
        writeFileSync(kindleFile, [
            'Dead Souls, Nikolai Gogol',
            '',
            'A highlight from Dead Souls that I want to keep forever.',
            '',
            'A brand new highlight from Dead Souls added on a later export.',
            ''
        ].join('\n'));

        const stats = DatabaseSeeder.importKindleHighlights(kindleFile);
        expect(stats).toMatchObject({ booksMatched: 1, booksCreated: 0, highlightsImported: 1, highlightsSkipped: 1 });

        const after = savedState();
        expect(after.books).toEqual(before.books);
        expect(after.reviews).toEqual(before.reviews);
        expect(after.highlights.slice(0, before.highlights.length)).toEqual(before.highlights);
        expect(after.highlights).toHaveLength(before.highlights.length + 1);
        expect(BookQueries.getAllBooks()).toHaveLength(bookCount);

        // Importing the same export again changes nothing
        DatabaseSeeder.importKindleHighlights(kindleFile);
        expect(savedState()).toEqual(after);
    });
});

describe('did-not-finish schema upgrade', () => {
    it('upgrades a pre-DNF database without losing books, highlights or reviews', () => {
        const oldDbPath = join(workDir, 'pre-dnf.db');
        const schema = readFileSync(join(__dirname, '../database/schema.sql'), 'utf-8')
            .replace("'completed', 'did_not_finish'", "'completed'");
        expect(schema).not.toContain('did_not_finish');

        const old = new Database(oldDbPath);
        old.exec(schema);
        old.prepare(`
            INSERT INTO books (id, title, authors, position, status, progress_percentage, current_page, personal_rating)
            VALUES (1, 'Dead Souls', '["Nikolai Gogol"]', 1, 'in_progress', 37, 120, NULL),
                   (2, 'Invisible Cities', '["Italo Calvino"]', 2, 'completed', 100, 165, 5)
        `).run();
        old.prepare(`
            INSERT INTO highlights (id, book_id, quote_text, personal_notes)
            VALUES (1, 1, 'A highlight that must survive the upgrade.', 'note')
        `).run();
        old.prepare('INSERT INTO highlight_reviews (highlight_id, review_count, favorite) VALUES (1, 3, 1)').run();
        old.pragma('foreign_keys = ON');
        old.close();

        const originalPath = process.env['DATABASE_PATH'];
        process.env['DATABASE_PATH'] = oldDbPath;
        try {
            jest.isolateModules(() => {
                // Opening the connection runs the upgrade
                const { db: upgraded } = require('../database/connection');
                // The upgraded table accepts DNF
                upgraded.prepare("UPDATE books SET status = 'did_not_finish' WHERE id = 2").run();
                upgraded.prepare("UPDATE books SET status = 'completed' WHERE id = 2").run();

                expect(upgraded.prepare('SELECT id, status, progress_percentage, current_page, personal_rating FROM books ORDER BY id').all())
                    .toEqual([
                        { id: 1, status: 'in_progress', progress_percentage: 37, current_page: 120, personal_rating: null },
                        { id: 2, status: 'completed', progress_percentage: 100, current_page: 165, personal_rating: 5 }
                    ]);
                expect(upgraded.prepare('SELECT book_id, quote_text, personal_notes FROM highlights').all())
                    .toEqual([{ book_id: 1, quote_text: 'A highlight that must survive the upgrade.', personal_notes: 'note' }]);
                expect(upgraded.prepare('SELECT highlight_id, review_count, favorite FROM highlight_reviews').all())
                    .toEqual([{ highlight_id: 1, review_count: 3, favorite: 1 }]);
                upgraded.close();
            });
        } finally {
            process.env['DATABASE_PATH'] = originalPath;
        }
    });
});
