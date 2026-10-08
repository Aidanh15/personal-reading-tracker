/**
 * Guards the reader's saved data against everything that writes to it outside
 * normal use: the container entrypoint (seed-user-data), Kindle imports, schema
 * upgrades, the one-time reading-list apply, and Up Next editing. None of these
 * may lose or change progress, ratings, reviews, highlights or review state.
 */
import Database from 'better-sqlite3';
import { mkdirSync, mkdtempSync, readFileSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { DatabaseSeeder } from '../database/seed';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { db } from '../database/connection';
import { applyReadingList } from '../database/applyReadingList';
import { findBookByTitle } from '../database/library';
import { syncClippingsFolder } from '../services/clippingsSync';
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

/** Same steps as scripts/docker-entrypoint.sh. */
async function runStartup() {
    await DatabaseSeeder.seedWithUserData(join(workDir, 'missing-kindle.txt'), join(workDir, 'missing-list.txt'));
}

function bookByTitle(title: string) {
    return BookQueries.getAllBooks().find(book => book.title === title)!;
}

function addReview(highlightId: number, reviewCount: number, favorite: 0 | 1, lastReviewedAt: string) {
    db.prepare(`
        INSERT INTO highlight_reviews (highlight_id, last_reviewed_at, next_review_at, review_count, favorite, archived)
        VALUES (?, ?, ?, ?, ?, 0)
    `).run(highlightId, lastReviewedAt, '2026-12-01T08:00:00.000Z', reviewCount, favorite);
}

beforeEach(() => {
    db.exec('DELETE FROM daily_review_queue; DELETE FROM highlight_reviews;');
    DatabaseSeeder.clearDatabase();
    seedLibrary();
});

describe('deploy startup', () => {
    it('keeps all saved progress, highlights and review state, across repeated deploys', async () => {
        const before = savedState();

        await runStartup();
        expect(savedState()).toEqual(before);

        await runStartup();
        expect(savedState()).toEqual(before);
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

describe('Kindle import title matching', () => {
    it('never attaches highlights to a different book with a similar title', () => {
        addBook('Discourses', 'Niccolò Machiavelli', 60);
        const kindleFile = join(workDir, 'kindle-epictetus.txt');
        writeFileSync(kindleFile, [
            'Discourses and Selected Writings, Epictetus',
            '',
            'Whatever is rational is tolerable for a creature that thinks.',
            ''
        ].join('\n'));

        const stats = DatabaseSeeder.importKindleHighlights(kindleFile);

        expect(stats).toMatchObject({ booksMatched: 0, booksCreated: 1 });
        expect(HighlightQueries.getHighlightsByBookId(bookByTitle('Discourses').id)).toHaveLength(0);
        expect(bookByTitle('Discourses and Selected Writings')).toMatchObject({ unscheduled: true });
    });

    it('matches Kindle titles with subtitles and editions, but not other books sharing words', () => {
        const books = [
            addBook('Stoner', 'John Williams', 70),
            addBook('The Road', 'Cormac McCarthy', 71),
            addBook('The Road to Los Angeles', 'John Fante', 72)
        ];

        expect(findBookByTitle('Stoner, A Novel (Vintage Classics)', ['Unknown'], books)?.title).toBe('Stoner');
        expect(findBookByTitle('The Road', ['Unknown'], books)?.title).toBe('The Road');
        expect(findBookByTitle('The Road to Wigan Pier', ['George Orwell'], books)).toBeUndefined();
    });
});

describe('clippings.io folder sync', () => {
    it('imports only new highlights from new or changed export files, leaving existing ones alone', () => {
        const folder = join(workDir, `clippings-${Date.now()}`);
        mkdirSync(folder);
        const deadSouls = bookByTitle('Dead Souls');
        const existing = HighlightQueries.getHighlightsByBookId(deadSouls.id)[0]!;
        const before = savedState();

        const file = join(folder, 'Dead Souls (Penguin Classics).md');
        writeFileSync(file, `${existing.quoteText}\n\n\nA second passage from Dead Souls that arrived in a later export.\n\n\n`);
        const first = syncClippingsFolder(folder);
        expect(first).toMatchObject({ filesSeen: 1, filesImported: 1, highlightsImported: 1, booksCreated: 0 });

        // Unchanged file: not even read again
        expect(syncClippingsFolder(folder)).toMatchObject({ filesSeen: 1, filesImported: 0, highlightsImported: 0 });

        // clippings.io rewrites the whole file when the book gains a highlight
        writeFileSync(file, `${readFileSync(file, 'utf-8')}A third passage from Dead Souls, highlighted much later on.\n\n\n`);
        utimesSync(file, new Date(), new Date(Date.now() + 5000));
        expect(syncClippingsFolder(folder)).toMatchObject({ filesImported: 1, highlightsImported: 1 });

        const after = savedState();
        expect(after.highlights.slice(0, before.highlights.length)).toEqual(before.highlights);
        expect(after.reviews).toEqual(before.reviews);
        expect(after.books).toEqual(before.books);
        expect(HighlightQueries.getHighlightsByBookId(deadSouls.id)).toHaveLength(3);
    });

    it('reports a missing folder without failing', () => {
        expect(syncClippingsFolder(join(workDir, 'does-not-exist')).error).toBe('Sync folder not found');
    });
});

describe('one-time reading list apply', () => {
    function seedDuplicates() {
        const zarathustra = addBook('Thus Spoke Zarathustra', 'Friedrich Nietzsche', 41, { status: 'completed', progressPercentage: 100 });
        const junk = addBook('In truth', 'I have often laughed at the weaklings', 42, { status: 'completed', progressPercentage: 100 });
        const quote = 'In truth, I have often laughed at the weaklings who think themselves good.';
        HighlightQueries.createHighlight(zarathustra.id, { quoteText: quote });
        const junkCopy = HighlightQueries.createHighlight(junk.id, { quoteText: quote });
        addReview(junkCopy.id, 3, 1, '2026-10-01T08:00:00.000Z');

        const epictetus = addBook('Discourses and Selected Writings (Penguin Classics)', 'Epictetus', 6, { status: 'completed', progressPercentage: 100 });
        const machiavelli = addBook('Discourses', 'Niccolò Machiavelli', 144);
        const stoic = 'Whatever is rational is tolerable for a creature that thinks.';
        HighlightQueries.createHighlight(epictetus.id, { quoteText: stoic });
        HighlightQueries.createHighlight(machiavelli.id, { quoteText: stoic });

        addBook('The Gulag Archipelago (Abridged)', 'Aleksandr Solzhenitsyn', 29);
        addBook('Moby-Dick', 'Herman Melville', 50);
        addBook('In Search of Lost Time', 'Marcel Proust', 85.5);
        addBook('Some Book I Dropped', 'Someone Else', 60);
    }

    function distinctQuotes() {
        return (db.prepare('SELECT DISTINCT quote_text FROM highlights ORDER BY quote_text').all() as { quote_text: string }[])
            .map(row => row.quote_text);
    }

    it('saves nothing in a dry run', async () => {
        seedDuplicates();
        const before = db.prepare('SELECT * FROM books ORDER BY id').all();
        const beforeHighlights = db.prepare('SELECT * FROM highlights ORDER BY id').all();

        const report = await applyReadingList({ dryRun: true, fetchCovers: false });

        expect(report.merged.length).toBeGreaterThan(0);
        expect(db.prepare('SELECT * FROM books ORDER BY id').all()).toEqual(before);
        expect(db.prepare('SELECT * FROM highlights ORDER BY id').all()).toEqual(beforeHighlights);
    });

    it('cleans up duplicates without losing any highlight text, review state or progress', async () => {
        seedDuplicates();
        const quotesBefore = distinctQuotes();
        const before = savedState();

        await applyReadingList({ dryRun: false, fetchCovers: false });

        expect(distinctQuotes()).toEqual(quotesBefore);
        expect(bookByTitle('In truth')).toBeUndefined();
        expect(HighlightQueries.getHighlightsByBookId(bookByTitle('Discourses').id)).toHaveLength(0);

        // The junk copy's review history (a favourite) moved to the real copy
        const kept = HighlightQueries.getHighlightsByBookId(bookByTitle('Thus Spoke Zarathustra').id)[0]!;
        expect(db.prepare('SELECT review_count, favorite FROM highlight_reviews WHERE highlight_id = ?').get(kept.id))
            .toEqual({ review_count: 3, favorite: 1 });

        // Every surviving book keeps its progress; only the current book is started
        const after = savedState();
        const afterById = new Map(after.books.map((book: any) => [book.id, book]));
        const gulag = bookByTitle('The Gulag Archipelago (Abridged)');
        for (const book of before.books as any[]) {
            const now = afterById.get(book.id) as any;
            if (!now || book.id === gulag.id) continue;
            expect(now).toEqual(book);
        }
        expect(gulag).toMatchObject({ status: 'in_progress', position: 29 });
    });

    it('places list books, the parallel track and dropped books', async () => {
        seedDuplicates();

        const report = await applyReadingList({ dryRun: false, fetchCovers: false });

        expect(bookByTitle('Moby-Dick')).toMatchObject({
            position: 31, phase: 'Phase 4 — The American Experiment', milestone: 'Peak', category: 'F', unscheduled: false
        });
        expect(bookByTitle('Darkness at Noon')).toMatchObject({ position: 30, status: 'not_started' });
        expect(bookByTitle('In Search of Lost Time')).toMatchObject({ parallelTrack: true, unscheduled: false });
        expect(bookByTitle('Some Book I Dropped')).toMatchObject({ unscheduled: true, status: 'not_started' });
        // In-progress and finished books outside the list stay where they were
        expect(bookByTitle('Dead Souls')).toMatchObject({ status: 'in_progress', position: 19, unscheduled: false });
        expect(report.listCreated.length + report.listMatched).toBe(140);
    });

    it('is safe to run twice', async () => {
        seedDuplicates();
        // updated_at is bumped by a trigger on any write, even an identical one
        const books = () => (db.prepare('SELECT * FROM books ORDER BY id').all() as any[])
            .map(({ updated_at, ...book }) => book);
        await applyReadingList({ dryRun: false, fetchCovers: false });
        const afterFirst = books();

        const second = await applyReadingList({ dryRun: false, fetchCovers: false });

        expect(second).toMatchObject({ merged: [], duplicateHighlightsRemoved: [], statusChanges: [], listCreated: [], unscheduled: [] });
        expect(books()).toEqual(afterFirst);
    });
});

describe('Up Next editing', () => {
    function upNextTitles() {
        return BookQueries.getUpNextBooks().map(book => book.title);
    }

    beforeEach(() => {
        DatabaseSeeder.clearDatabase();
        addBook('Current Book', 'A', 29, { status: 'in_progress', progressPercentage: 12 });
        addBook('First', 'A', 30, { phase: 'Phase 3' });
        addBook('Second', 'A', 31, { phase: 'Phase 3' });
        addBook('Third', 'A', 32, { phase: 'Phase 4', milestone: 'Peak' });
    });

    it('reorders from where the list starts, moving a book into the section it is dropped in', () => {
        const [first, second, third] = BookQueries.getUpNextBooks();

        BookQueries.saveUpNextOrder([
            { id: third!.id, phase: 'Phase 3' },
            { id: first!.id, phase: 'Phase 3' },
            { id: second!.id, phase: 'Phase 3' }
        ]);

        expect(upNextTitles()).toEqual(['Third', 'First', 'Second']);
        expect(bookByTitle('Third')).toMatchObject({ position: 30, phase: 'Phase 3', milestone: 'Peak' });
        expect(bookByTitle('Current Book')).toMatchObject({ position: 29, progressPercentage: 12 });
    });

    it('rejects an order that leaves out or repeats a book', () => {
        const [first, second] = BookQueries.getUpNextBooks();

        expect(() => BookQueries.saveUpNextOrder([{ id: first!.id }, { id: second!.id }])).toThrow();
        expect(() => BookQueries.saveUpNextOrder([{ id: first!.id }, { id: first!.id }, { id: second!.id }])).toThrow();
        expect(upNextTitles()).toEqual(['First', 'Second', 'Third']);
    });

    it('moves a book to Unscheduled and back without changing anything else', () => {
        const second = bookByTitle('Second');
        HighlightQueries.createHighlight(second.id, { quoteText: 'A highlight that must survive unscheduling.' });

        BookQueries.setUnscheduled(second.id, true);
        expect(upNextTitles()).toEqual(['First', 'Third']);

        BookQueries.setUnscheduled(second.id, false);
        expect(upNextTitles()).toEqual(['First', 'Third', 'Second']);
        expect(bookByTitle('Second')).toMatchObject({ phase: 'Phase 4', status: 'not_started' });
        expect(HighlightQueries.getHighlightsByBookId(second.id)).toHaveLength(1);
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
