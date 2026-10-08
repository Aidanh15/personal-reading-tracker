import { db } from './connection';
import { BookQueries } from './queries/books';
import { findBookByTitle, mergeBooks, removeHighlightsDuplicatedOn } from './library';
import { CURRENT_BOOK_POSITION, PARALLEL_TRACK, READING_LIST_OCT_2026, ReadingListEntry } from './data/readingListOct2026';
import { CoverService } from '../services/coverService';
import { Book } from '../types';

/**
 * One-time switch from the hard-coded master plan to the October 2026 list,
 * plus cleanup of duplicates left by the old Kindle importer. Idempotent: a
 * second run finds nothing left to fix. Never changes a book's progress,
 * rating, review or highlights (duplicates are collapsed with review state kept).
 */

const UNSCHEDULED_START = 1000;

export interface ReadingListReport {
    merged: string[];
    duplicateHighlightsRemoved: string[];
    statusChanges: string[];
    listMatched: number;
    listCreated: string[];
    unscheduled: string[];
    movedOffList: string[];
    coversFetched: string[];
}

class DryRunRollback extends Error {}

function bookCount(id: number): number {
    return (db.prepare('SELECT COUNT(*) AS n FROM highlights WHERE book_id = ?').get(id) as { n: number }).n;
}

function label(book: Book): string {
    return `"${book.title.replace(/\s+/g, ' ').slice(0, 70)}" (#${book.id})`;
}

function cleanUpDuplicates(report: ReadingListReport): void {
    const books = () => BookQueries.getAllBooks();
    const byTitle = (test: (title: string) => boolean, extra: (book: Book) => boolean = () => true) =>
        books().filter(book => test(book.title) && extra(book));
    const one = (test: (title: string) => boolean, extra?: (book: Book) => boolean) => {
        const found = byTitle(test, extra);
        return found.length === 1 ? found[0] : undefined;
    };
    const is = (title: string) => (candidate: string) => candidate === title;
    const startsWith = (prefix: string) => (candidate: string) => candidate.startsWith(prefix);

    const merge = (source: Book | undefined, target: Book | undefined) => {
        if (!source || !target || source.id === target.id) return;
        const { moved, collapsed } = mergeBooks(source.id, target.id);
        report.merged.push(`${label(source)} → ${label(target)}: ${moved} highlights moved, ${collapsed} duplicates collapsed`);
    };

    // Junk "books" the old text parser made from quote lines
    merge(one(startsWith('Mine is a rugged land')), one(startsWith('The Odyssey')));
    merge(one(is('In truth')), one(is('Thus Spoke Zarathustra')));
    merge(one(is('Like so many chain-smokers')), one(startsWith('When McKinsey Comes to Town')));

    // The same book recorded twice; the copy carrying the reader's state is kept
    merge(one(startsWith('Studies in Pessimism, On Human Nature')), one(is('On Human Nature; Studies in Pessimism')));
    merge(one(is('The Trial'), book => book.status === 'not_started'), one(is('The Trial (Penguin Modern Classics)')));
    for (const title of ['Slaughterhouse-Five', 'Rapture']) {
        const copies = byTitle(is(title)).sort((a, b) => bookCount(b.id) - bookCount(a.id) || a.position - b.position);
        for (const extra of copies.slice(1)) merge(extra, copies[0]);
    }

    // Highlights the old importer copied onto a different book with a similar title
    const strip = (from: Book | undefined, keepOn: Book | undefined) => {
        if (!from || !keepOn) return;
        const removed = removeHighlightsDuplicatedOn(from.id, keepOn.id);
        if (removed > 0) report.duplicateHighlightsRemoved.push(`${removed} from ${label(from)} (they belong to ${label(keepOn)})`);
    };
    strip(one(is('Discourses'), book => book.authors.some(a => a.includes('Machiavelli'))), one(startsWith('Discourses and Selected Writings')));
    strip(one(startsWith('1984')), one(startsWith('Fahrenheit 451')));
}

function applyEntry(book: Book, entry: ReadingListEntry): void {
    BookQueries.updateBook(book.id, {
        position: entry.position,
        phase: entry.phase,
        milestone: entry.milestone ?? null,
        category: entry.category,
        parallelTrack: false,
        unscheduled: false
    });
}

function applyList(report: ReadingListReport): number[] {
    const created: number[] = [];
    const claimed = new Set<number>();
    const unclaimed = () => BookQueries.getAllBooks().filter(book => !claimed.has(book.id));

    for (const entry of READING_LIST_OCT_2026) {
        let book = findBookByTitle(entry.title, entry.authors, unclaimed());
        if (book) {
            report.listMatched += 1;
        } else {
            book = BookQueries.createBook({ title: entry.title, authors: entry.authors, position: entry.position });
            created.push(book.id);
            report.listCreated.push(`#${entry.position} ${entry.title} — ${entry.authors.join(' & ')}`);
        }
        claimed.add(book.id);
        applyEntry(book, entry);

        if (entry.position === CURRENT_BOOK_POSITION && book.status === 'not_started') {
            BookQueries.updateBook(book.id, { status: 'in_progress', startedDate: new Date().toISOString() });
            report.statusChanges.push(`${label(book)} marked in progress (your current book)`);
        }
    }

    const proust = findBookByTitle(PARALLEL_TRACK.title, PARALLEL_TRACK.authors, unclaimed());
    if (proust) {
        claimed.add(proust.id);
        BookQueries.updateBook(proust.id, {
            phase: PARALLEL_TRACK.phase,
            category: PARALLEL_TRACK.category,
            milestone: null,
            parallelTrack: true,
            unscheduled: false
        });
    }

    // Everything else leaves the numbered list; nothing else about it changes
    const offList = unclaimed().sort((a, b) => a.position - b.position);
    let nextPosition = Math.max(UNSCHEDULED_START, ...offList.filter(b => b.position >= UNSCHEDULED_START).map(b => b.position + 1));
    for (const book of offList) {
        if (book.status === 'not_started') {
            const changes: Partial<Book> = { unscheduled: true };
            if (book.position < UNSCHEDULED_START) changes.position = nextPosition++;
            if (!book.unscheduled) report.unscheduled.push(label(book));
            BookQueries.updateBook(book.id, changes);
        } else if (book.status !== 'in_progress' && book.position >= CURRENT_BOOK_POSITION && book.position < UNSCHEDULED_START) {
            // Finished books outside the new list keep their place in the archive,
            // just out of the way of the list's numbering
            BookQueries.updateBook(book.id, { position: nextPosition++ });
            report.movedOffList.push(`${label(book)} (${book.status})`);
        }
    }

    return created;
}

export async function applyReadingList(options: { dryRun: boolean; fetchCovers?: boolean }): Promise<ReadingListReport> {
    const report: ReadingListReport = {
        merged: [], duplicateHighlightsRemoved: [], statusChanges: [], listMatched: 0,
        listCreated: [], unscheduled: [], movedOffList: [], coversFetched: []
    };

    let created: number[] = [];
    try {
        db.transaction(() => {
            cleanUpDuplicates(report);
            created = applyList(report);
            if (options.dryRun) throw new DryRunRollback();
        })();
    } catch (error) {
        if (!(error instanceof DryRunRollback)) throw error;
        return report;
    }

    if (options.fetchCovers ?? true) {
        for (const id of created) {
            const book = BookQueries.getBookById(id);
            if (!book || book.coverImageUrl) continue;
            const cover = await CoverService.getCoverForBook(book.title, book.authors);
            if (cover.localPath) {
                BookQueries.updateBook(id, { coverImageUrl: cover.localPath });
                report.coversFetched.push(book.title);
            }
        }
    }

    return report;
}

export function printReadingListReport(report: ReadingListReport, dryRun: boolean): void {
    const section = (title: string, lines: string[]) => {
        console.log(`\n${title} (${lines.length})`);
        lines.forEach(line => console.log(`  - ${line}`));
    };
    console.log(dryRun ? '\nDRY RUN: nothing was saved' : '\nApplied');
    section('Duplicate books merged', report.merged);
    section('Misattributed highlights removed', report.duplicateHighlightsRemoved);
    section('Status changes', report.statusChanges);
    console.log(`\nList entries matched to existing books: ${report.listMatched}`);
    section('New books added from the list', report.listCreated);
    section('Moved to the Unscheduled shelf', report.unscheduled);
    section('Finished books moved out of the list numbering', report.movedOffList);
    if (!dryRun) section('Covers fetched', report.coversFetched);
}
