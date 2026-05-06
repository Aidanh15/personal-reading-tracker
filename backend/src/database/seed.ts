import { BookQueries } from './queries/books';
import { HighlightQueries } from './queries/highlights';
import { CreateBookRequest, CreateHighlightRequest } from '../types';
import { db } from './connection';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { basename, extname } from 'path';
import { CoverService, CoverSearchResult } from '../services/coverService';
import { readZipTextEntries } from '../utils/zip';

interface ParsedBook {
    title: string;
    authors: string[];
    highlights: CreateHighlightRequest[];
}

interface KindleImportStats {
    booksParsed: number;
    booksMatched: number;
    booksCreated: number;
    highlightsParsed: number;
    highlightsImported: number;
    highlightsSkipped: number;
}

interface ReadingPlanBook {
    position: number;
    title: string;
    authors: string[];
    status?: 'not_started' | 'in_progress' | 'completed';
    aliases?: string[];
}

export class DatabaseSeeder {
    private static readonly KINDLE_METADATA_OVERRIDES: ReadingPlanBook[] = [
        {
            position: 0,
            title: 'War and Peace',
            authors: ['Leo Tolstoy'],
            status: 'completed',
            aliases: ['War And Peace']
        },
        {
            position: 0,
            title: 'The True Believer',
            authors: ['Eric Hoffer'],
            aliases: ['The True Believer, Thoughts on the Nature of Mass Movements']
        },
        {
            position: 0,
            title: 'Guerilla Days in Ireland',
            authors: ['Tom Barry']
        },
        {
            position: 0,
            title: 'Slaughterhouse-Five',
            authors: ['Kurt Vonnegut'],
            status: 'completed',
            aliases: [
                'Slaughterhouse 5, Discover Kurt Vonnegut\'s anti-war masterpiece',
                'Slaughterhouse 5, Discover Kurt Vonnegut’s anti-war masterpiece'
            ]
        },
        {
            position: 0,
            title: 'Nausea',
            authors: ['Jean-Paul Sartre']
        }
    ];

    private static readonly REVISED_MASTER_READING_PLAN: ReadingPlanBook[] = [
        { position: 17, title: 'Plato: Five Dialogues', authors: ['Plato'], status: 'completed' },
        { position: 18, title: 'Demons', authors: ['Fyodor Dostoevsky'], status: 'in_progress', aliases: ['The Possessed'] },
        { position: 19, title: 'Invisible Cities', authors: ['Italo Calvino'] },
        { position: 20, title: 'The Gulag Archipelago (Abridged)', authors: ['Aleksandr Solzhenitsyn'], aliases: ['The Gulag Archipelago: The Authorized Abridgement'] },
        { position: 21, title: 'Nicomachean Ethics', authors: ['Aristotle'], aliases: ['Aristotle\'s Nicomachean Ethics'] },
        { position: 22, title: 'On Human Nature; Studies in Pessimism', authors: ['Arthur Schopenhauer'], aliases: ['On Human Nature, Studies in Pessimism, etc.'] },
        { position: 23, title: 'The Kingdom of God Is Within You', authors: ['Leo Tolstoy'] },
        { position: 24, title: 'Anna Karenina', authors: ['Leo Tolstoy'] },
        { position: 25, title: 'The Grapes of Wrath', authors: ['John Steinbeck'] },
        { position: 26, title: 'On the Road', authors: ['Jack Kerouac'] },
        { position: 27, title: 'Catch-22', authors: ['Joseph Heller'] },
        { position: 28, title: 'A Clockwork Orange', authors: ['Anthony Burgess'] },
        { position: 29, title: 'Pnin', authors: ['Vladimir Nabokov'] },
        { position: 30, title: 'Desolation Angels', authors: ['Jack Kerouac'] },
        { position: 31, title: 'White Noise', authors: ['Don DeLillo'] },
        { position: 32, title: 'Infinite Jest', authors: ['David Foster Wallace'] },
        { position: 33, title: 'The Road', authors: ['Cormac McCarthy'] },
        { position: 34, title: 'Blood Meridian', authors: ['Cormac McCarthy'] },
        { position: 35, title: 'The Iliad', authors: ['Homer'], aliases: ['The Iliad of Homer'] },
        { position: 36, title: 'Metamorphoses', authors: ['Ovid'], aliases: ['The Metamorphoses'] },
        { position: 37, title: 'The Origin of Consciousness in the Breakdown of the Bicameral Mind', authors: ['Julian Jaynes'] },
        { position: 38, title: 'The Art of Rhetoric', authors: ['Aristotle'] },
        { position: 39, title: 'The Art of War', authors: ['Sun Tzu'] },
        { position: 40, title: 'The Moon Is Down', authors: ['John Steinbeck'] },
        { position: 41, title: 'Discourses, Fragments, Handbook', authors: ['Epictetus'] },
        { position: 42, title: 'In Praise of Folly', authors: ['Erasmus'] },
        { position: 43, title: 'Don Quixote', authors: ['Miguel de Cervantes'], aliases: ['Don Quixote - Miguel De Cervantes Saavedra'] },
        { position: 44, title: 'Les Miserables', authors: ['Victor Hugo'] },
        { position: 45, title: 'Ulysses', authors: ['James Joyce'] },
        { position: 46, title: 'The Poetics of Space', authors: ['Gaston Bachelard'] },
        { position: 47, title: 'The Waste Land', authors: ['T. S. Eliot'] },
        { position: 48, title: 'The Recognitions', authors: ['William Gaddis'] },
        { position: 49, title: 'The Selfish Gene', authors: ['Richard Dawkins'] },
        { position: 50, title: 'The Crying of Lot 49', authors: ['Thomas Pynchon'] },
        { position: 51, title: 'Gravity\'s Rainbow', authors: ['Thomas Pynchon'] },
        { position: 52, title: 'The God Delusion', authors: ['Richard Dawkins'] },
        { position: 53, title: 'Lolita', authors: ['Vladimir Nabokov'] },
        { position: 54, title: 'Strange Pilgrims', authors: ['Gabriel Garcia Marquez'] },
        { position: 55, title: 'Foucault\'s Pendulum', authors: ['Umberto Eco'] },
        { position: 56, title: 'Technofeudalism', authors: ['Yanis Varoufakis'], aliases: ['Technofeudalism: What Killed Capitalism'] },
        { position: 57, title: 'All the Devils Are Here', authors: ['Bethany McLean', 'Joe Nocera'] },
        { position: 58, title: 'Dopesick', authors: ['Beth Macy'], aliases: ['Dopesick: Dealers, Doctors and the Drug Company that Addicted America'] },
        { position: 59, title: 'No More Tears', authors: ['Gardiner Harris'], aliases: ['No More Tears: The Dark Secrets of Johnson & Johnson'] },
        { position: 60, title: 'The Abolition of Man', authors: ['C. S. Lewis'] },
        { position: 61, title: 'Right/Wrong', authors: ['Juan Enriquez'], aliases: ['Right/Wrong: How Technology Transforms Our Ethics'] },
        { position: 62, title: 'The Racket', authors: ['Conor Niland'] },
        { position: 63, title: 'The Undiscovered Self', authors: ['C. G. Jung'] },
        { position: 64, title: 'Knowledge in a Nutshell: Carl Jung', authors: ['Gary Bobroff'] },
        { position: 65, title: 'The Looming Tower', authors: ['Lawrence Wright'], aliases: ['The Looming Tower: Al-Qaeda and the Road to 9/11'] },
        { position: 66, title: 'A Preface to Paradise Lost', authors: ['C. S. Lewis'] },
        { position: 67, title: 'Paradise Lost & Paradise Regained', authors: ['John Milton'] },
        { position: 68, title: 'The Lord of the Rings', authors: ['J. R. R. Tolkien'] },
        { position: 69, title: 'The Road to Los Angeles', authors: ['John Fante'] },
        { position: 70, title: 'Of Human Bondage', authors: ['W. Somerset Maugham'] },
        { position: 71, title: 'Ask the Dust', authors: ['John Fante'] },
        { position: 72, title: 'American Psycho', authors: ['Bret Easton Ellis'] },
        { position: 73, title: 'Dreams from Bunker Hill', authors: ['John Fante'] },
        { position: 74, title: 'The Return of the Native', authors: ['Thomas Hardy'] },
        { position: 75, title: 'Discourses', authors: ['Niccolo Machiavelli'] },
        { position: 76, title: 'The Famine Plot', authors: ['Tim Pat Coogan'], aliases: ['The Famine Plot: England\'s Role in Ireland\'s Greatest Tragedy'] },
        { position: 77, title: 'The Twelve Apostles', authors: ['Tim Pat Coogan'] },
        { position: 78, title: 'How to Live: A Life of Montaigne', authors: ['Sarah Bakewell'] },
        { position: 79, title: 'Essays', authors: ['Michel de Montaigne'] },
        { position: 80, title: 'Man\'s Search for Meaning', authors: ['Viktor Frankl'] },
        { position: 81, title: 'Rapture (BioShock)', authors: ['John Shirley'], aliases: ['Rapture'] }
    ];

    // Reading list from the provided data - extracted from KindleHighlights.txt
    private static readonly READING_LIST: CreateBookRequest[] = [
        {
            title: '1984',
            authors: ['George Orwell'],
            totalPages: 328
        },
        {
            title: 'A Portrait of the Artist as a Young Man',
            authors: ['James Joyce'],
            totalPages: 253
        },
        {
            title: 'Basic Writings of Nietzsche',
            authors: ['Friedrich Nietzsche', 'Walter Kaufmann'],
            totalPages: 784
        },
        {
            title: 'Brave New World',
            authors: ['Aldous Huxley'],
            totalPages: 268
        },
        {
            title: 'Crime and Punishment',
            authors: ['Fyodor Dostoyevsky'],
            totalPages: 671
        },
        {
            title: 'Discourses and Selected Writings',
            authors: ['Epictetus', 'Robert Dobbin'],
            totalPages: 304
        }
    ];

    // Sample books for testing when Kindle file is not available
    private static readonly SAMPLE_BOOKS: CreateBookRequest[] = [
        {
            title: 'The Myth of Sisyphus',
            authors: ['Albert Camus'],
            totalPages: 212
        },
        {
            title: 'Meditations',
            authors: ['Marcus Aurelius'],
            totalPages: 304
        },
        {
            title: 'The Republic',
            authors: ['Plato'],
            totalPages: 416
        }
    ];

    // Sample highlights for testing
    private static readonly SAMPLE_HIGHLIGHTS: Record<string, CreateHighlightRequest[]> = {
        'The Myth of Sisyphus': [
            {
                quoteText: 'There is but one truly serious philosophical problem, and that is suicide.',
                pageNumber: 3,
                personalNotes: 'Opening line - sets the tone for the entire work'
            },
            {
                quoteText: 'The struggle itself toward the heights is enough to fill a man\'s heart.',
                pageNumber: 123,
                personalNotes: 'The essence of the absurd hero'
            }
        ],
        'Meditations': [
            {
                quoteText: 'You have power over your mind - not outside events. Realize this, and you will find strength.',
                pageNumber: 45,
                personalNotes: 'Core Stoic principle about internal locus of control'
            },
            {
                quoteText: 'The best revenge is not to be like your enemy.',
                pageNumber: 78,
                personalNotes: 'Stoic approach to dealing with adversity'
            }
        ],
        'The Republic': [
            {
                quoteText: 'The unexamined life is not worth living.',
                pageNumber: 156,
                personalNotes: 'Socratic wisdom about self-reflection'
            }
        ]
    };

    // Parse reading list from text file
    static parseReadingList(filePath: string): CreateBookRequest[] {
        console.log(`Parsing reading list from: ${filePath}`);

        if (!existsSync(filePath)) {
            console.warn(`Reading list file not found: ${filePath}`);
            return [];
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').map(line => line.trim()).filter(line => line);

            const books: CreateBookRequest[] = [];

            for (const line of lines) {
                if (!line.startsWith('*')) continue;

                // Remove the * and trim
                const bookLine = line.substring(1).trim();

                // Split by last dash to separate title from author(s)
                const lastDashIndex = bookLine.lastIndexOf(' - ');
                if (lastDashIndex === -1) continue;

                const title = bookLine.substring(0, lastDashIndex).trim();
                const authorsStr = bookLine.substring(lastDashIndex + 3).trim();
                const authors = authorsStr.split(',').map(a => a.trim());

                books.push({
                    title,
                    authors,
                    position: books.length + 1
                });
            }

            console.log(`Parsed ${books.length} books from reading list`);
            return books;
        } catch (error) {
            console.error('Failed to parse reading list:', error);
            return [];
        }
    }

    // Parse Kindle highlights from text file or ZIP of per-book Markdown files
    static parseKindleHighlights(filePath: string): ParsedBook[] {
        console.log(`Parsing Kindle highlights from: ${filePath}`);

        if (!existsSync(filePath)) {
            console.warn(`Kindle highlights file not found: ${filePath}`);
            return [];
        }

        if (filePath.toLowerCase().endsWith('.zip')) {
            return this.parseKindleHighlightsZip(filePath);
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').map(line => line.trim());

            const books: Map<string, ParsedBook> = new Map();
            let currentBook: string | null = null;

            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];

                // Empty line - just continue, don't reset current book yet
                if (!line) {
                    continue;
                }

                // Check for book title format: "Title, Author" or "Title: Subtitle, Author"
                // Check for new book titles (even if we have a current book)
                if (line.includes(',')) {
                    const commaIndex = line.lastIndexOf(',');
                    if (commaIndex > 0) {
                        const beforeComma = line.substring(0, commaIndex).trim();
                        const afterComma = line.substring(commaIndex + 1).trim();

                        // Validate this looks like a book title line:
                        // 1. Not too long (quotes can be very long)
                        // 2. Doesn't contain quote marks
                        // 3. Author part looks like a name (starts with capital, reasonable length)
                        // 4. Title part starts with capital letter
                        if (beforeComma && afterComma &&
                            line.length < 300 &&  // Reasonable line length for a title
                            afterComma.length < 100 && // Author names shouldn't be too long
                            !line.includes('"') &&
                            !line.includes("'") &&
                            beforeComma.match(/^[A-Z0-9]/) && // Title starts with capital or number
                            afterComma.match(/^[A-Z]/)) { // Author starts with capital

                            currentBook = beforeComma;

                            if (!books.has(beforeComma)) {
                                books.set(beforeComma, {
                                    title: beforeComma,
                                    authors: [afterComma],
                                    highlights: []
                                });
                                console.log(`Found book: "${beforeComma}" by ${afterComma}`);
                            }
                            continue;
                        }
                    }
                }

                // If we have a current book and this line looks like a highlight
                if (currentBook && books.has(currentBook)) {
                    const book = books.get(currentBook)!;

                    // Skip very short lines or lines that look like metadata
                    if (line.length >= 30 && !line.match(/^(page|location|added on)/i)) {
                        book.highlights.push({
                            quoteText: line,
                            personalNotes: `Imported from Kindle highlights`
                        });
                        console.log(`  Added highlight to "${currentBook}": ${line.substring(0, 50)}...`);
                    }
                }
            }

            const result = Array.from(books.values()).filter(book => book.highlights.length > 0);
            console.log(`Parsed ${result.length} books with highlights from Kindle file`);

            return result;
        } catch (error) {
            console.error('Failed to parse Kindle highlights:', error);
            return [];
        }
    }

    static importKindleHighlights(filePath: string): KindleImportStats {
        console.log(`Importing Kindle highlights from: ${filePath}`);

        const parsedBooks = this.parseKindleHighlights(filePath);
        const stats: KindleImportStats = {
            booksParsed: parsedBooks.length,
            booksMatched: 0,
            booksCreated: 0,
            highlightsParsed: parsedBooks.reduce((sum, book) => sum + book.highlights.length, 0),
            highlightsImported: 0,
            highlightsSkipped: 0
        };

        const existingBooks = BookQueries.getAllBooks();

        const importTransaction = db.transaction(() => {
            for (const parsedBook of parsedBooks) {
                let book = this.findMatchingBook(parsedBook.title, existingBooks);

                if (book) {
                    stats.booksMatched += 1;
                } else {
                    book = BookQueries.createBook({
                        title: parsedBook.title,
                        authors: parsedBook.authors,
                        position: existingBooks.length + stats.booksCreated + 1
                    });
                    existingBooks.push(book);
                    stats.booksCreated += 1;
                    console.log(`Created book from highlights: ${book.title}`);
                }

                for (const highlightData of parsedBook.highlights) {
                    if (HighlightQueries.highlightExists(book.id, highlightData.quoteText)) {
                        stats.highlightsSkipped += 1;
                        continue;
                    }

                    HighlightQueries.createHighlight(book.id, highlightData);
                    stats.highlightsImported += 1;
                }
            }
        });

        importTransaction();

        console.log(`Parsed ${stats.booksParsed} books and ${stats.highlightsParsed} highlights`);
        console.log(`Matched ${stats.booksMatched} books, created ${stats.booksCreated} books`);
        console.log(`Imported ${stats.highlightsImported} highlights, skipped ${stats.highlightsSkipped} duplicates`);

        return stats;
    }

    private static parseKindleHighlightsZip(filePath: string): ParsedBook[] {
        const zipBuffer = readFileSync(filePath);
        const markdownEntries = readZipTextEntries(zipBuffer, ['.md', '.markdown']);
        const parsedBooks: ParsedBook[] = [];

        for (const entry of markdownEntries) {
            const rawTitle = this.cleanKindleMarkdownTitle(entry.name);
            const override = this.findMetadataOverride(rawTitle);
            const title = override?.title ?? rawTitle;
            const highlights = this.parseKindleMarkdownHighlights(entry.content);

            if (!title || highlights.length === 0) {
                continue;
            }

            parsedBooks.push({
                title,
                authors: override?.authors ?? ['Unknown'],
                highlights
            });
        }

        console.log(`Parsed ${parsedBooks.length} books with highlights from Kindle ZIP`);
        return parsedBooks;
    }

    private static parseKindleMarkdownHighlights(content: string): CreateHighlightRequest[] {
        const normalizedContent = content
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n');

        return normalizedContent
            .split(/\n{2,}/)
            .map(block => block
                .split('\n')
                .map(line => line.trim())
                .filter(Boolean)
                .join(' ')
                .replace(/^[-*>#\s]+/, '')
                .trim()
            )
            .filter(quote => quote.length >= 20)
            .map(quoteText => ({
                quoteText: this.decodeHtmlEntities(quoteText),
                personalNotes: 'Imported from Kindle highlights'
            }));
    }

    private static cleanKindleMarkdownTitle(fileName: string): string {
        const titleWithExtension = basename(fileName);
        const extension = extname(titleWithExtension);
        const title = extension
            ? titleWithExtension.slice(0, -extension.length)
            : titleWithExtension;

        return this.decodeHtmlEntities(title)
            .replace(/\s*\([^)]*(classics|edition|complete|unabridged|penguin|hackett|oxford|modern)[^)]*\)\s*/gi, ' ')
            .replace(/,{2,}/g, ',')
            .replace(/\s+/g, ' ')
            .replace(/\s+,/g, ',')
            .trim();
    }

    private static findMatchingBook(title: string, books: ReturnType<typeof BookQueries.getAllBooks>[number][]) {
        const normalizedTitle = this.normalizeTitle(title);
        const titleTokens = this.titleTokens(title);

        return books.find(book => {
            const normalizedBookTitle = this.normalizeTitle(book.title);
            if (normalizedTitle.includes(normalizedBookTitle) || normalizedBookTitle.includes(normalizedTitle)) {
                return true;
            }

            const bookTokens = this.titleTokens(book.title);
            const sharedTokens = titleTokens.filter(token => bookTokens.includes(token));
            return sharedTokens.length >= Math.min(2, titleTokens.length, bookTokens.length);
        });
    }

    private static findMetadataOverride(title: string): ReadingPlanBook | undefined {
        return this.KINDLE_METADATA_OVERRIDES.find(entry =>
            this.matchesPlanTitle(title, entry)
        );
    }

    private static matchesPlanTitle(title: string, entry: ReadingPlanBook): boolean {
        const normalizedTitle = this.normalizeTitle(title);
        const possibleTitles = [entry.title, ...(entry.aliases ?? [])];

        return possibleTitles.some(possibleTitle => this.normalizeTitle(possibleTitle) === normalizedTitle);
    }

    static syncMasterReadingPlan(): {
        planned: number;
        matched: number;
        created: number;
        metadataUpdated: number;
        movedUnlisted: number;
    } {
        const stats = {
            planned: this.REVISED_MASTER_READING_PLAN.length,
            matched: 0,
            created: 0,
            metadataUpdated: 0,
            movedUnlisted: 0
        };

        const now = new Date().toISOString();
        const plannedBookIds = new Set<number>();

        const transaction = db.transaction(() => {
            this.decodeExistingBookMetadata();

            let books = BookQueries.getAllBooks();
            for (const metadata of this.KINDLE_METADATA_OVERRIDES) {
                const book = this.findBookForPlanEntry(metadata, books);
                if (!book) {
                    continue;
                }

                BookQueries.updateBook(book.id, {
                    title: metadata.title,
                    authors: metadata.authors,
                    ...(metadata.status ? { status: metadata.status } : {}),
                    ...(metadata.status === 'completed' ? {
                        progressPercentage: 100,
                        completedDate: book.completedDate ?? now
                    } : {})
                });
                stats.metadataUpdated += 1;
            }

            books = BookQueries.getAllBooks();

            for (const planBook of this.REVISED_MASTER_READING_PLAN) {
                const status = planBook.status ?? 'not_started';
                let book = this.findBookForPlanEntry(planBook, books);

                if (book) {
                    stats.matched += 1;
                    const updateData = {
                        title: planBook.title,
                        authors: planBook.authors,
                        position: planBook.position,
                        status,
                        progressPercentage: status === 'completed'
                            ? 100
                            : status === 'not_started'
                                ? 0
                                : book.progressPercentage,
                        currentPage: status === 'not_started' ? 0 : book.currentPage,
                        ...(status === 'completed' ? { completedDate: book.completedDate ?? now } : {}),
                        ...(status === 'in_progress' ? { startedDate: book.startedDate ?? now } : {})
                    };

                    BookQueries.updateBook(book.id, updateData);
                    plannedBookIds.add(book.id);
                } else {
                    book = BookQueries.createBook({
                        title: planBook.title,
                        authors: planBook.authors,
                        position: planBook.position,
                        status
                    });

                    if (status === 'completed' || status === 'in_progress') {
                        BookQueries.updateBook(book.id, {
                            progressPercentage: status === 'completed' ? 100 : 0,
                            ...(status === 'completed' ? { completedDate: now } : {}),
                            ...(status === 'in_progress' ? { startedDate: now } : {})
                        });
                    }

                    plannedBookIds.add(book.id);
                    books.push(book);
                    stats.created += 1;
                }
            }

            const refreshedBooks = BookQueries.getAllBooks();
            let overflowPosition = 1000;

            for (const book of refreshedBooks) {
                if (plannedBookIds.has(book.id) || book.status === 'completed') {
                    continue;
                }

                BookQueries.updateBook(book.id, {
                    position: overflowPosition++,
                    status: book.status === 'in_progress' ? 'completed' : book.status,
                    ...(book.status === 'in_progress' ? {
                        progressPercentage: 100,
                        completedDate: book.completedDate ?? now
                    } : {})
                });
                stats.movedUnlisted += 1;
            }
        });

        transaction();

        console.log(`Synced ${stats.planned} planned books`);
        console.log(`Matched ${stats.matched}, created ${stats.created}`);
        console.log(`Updated metadata for ${stats.metadataUpdated} Kindle-created books`);
        console.log(`Moved ${stats.movedUnlisted} unlisted active books to the end`);

        return stats;
    }

    private static decodeExistingBookMetadata(): void {
        const books = BookQueries.getAllBooks();

        for (const book of books) {
            const decodedTitle = this.decodeHtmlEntities(book.title);
            const decodedAuthors = book.authors.map(author => this.decodeHtmlEntities(author));

            if (
                decodedTitle !== book.title ||
                JSON.stringify(decodedAuthors) !== JSON.stringify(book.authors)
            ) {
                BookQueries.updateBook(book.id, {
                    title: decodedTitle,
                    authors: decodedAuthors
                });
            }
        }
    }

    private static findBookForPlanEntry(
        entry: ReadingPlanBook,
        books: ReturnType<typeof BookQueries.getAllBooks>[number][]
    ) {
        return books.find(book => {
            if (!this.matchesPlanTitle(book.title, entry)) {
                return false;
            }

            return this.authorsOverlap(book.authors, entry.authors) ||
                entry.aliases !== undefined ||
                book.authors.some(author => this.normalizeTitle(author) === 'unknown') ||
                entry.position === 0;
        });
    }

    private static authorsOverlap(bookAuthors: string[], planAuthors: string[]): boolean {
        return bookAuthors.some(bookAuthor =>
            planAuthors.some(planAuthor => {
                const normalizedBookAuthor = this.normalizeTitle(bookAuthor);
                const normalizedPlanAuthor = this.normalizeTitle(planAuthor);
                return normalizedBookAuthor.includes(normalizedPlanAuthor) ||
                    normalizedPlanAuthor.includes(normalizedBookAuthor);
            })
        );
    }

    private static normalizeTitle(title: string): string {
        return title
            .toLowerCase()
            .replace(/\([^)]*\)/g, ' ')
            .replace(/[^a-z0-9]+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    private static titleTokens(title: string): string[] {
        const stopwords = new Set([
            'a', 'an', 'and', 'by', 'complete', 'edition', 'for', 'in', 'of', 'on', 'penguin',
            'the', 'to', 'unabridged', 'with'
        ]);

        return this.normalizeTitle(title)
            .split(' ')
            .filter(token => token.length > 2 && !stopwords.has(token));
    }

    private static decodeHtmlEntities(value: string): string {
        const namedEntities: Record<string, string> = {
            amp: '&',
            apos: "'",
            gt: '>',
            lt: '<',
            quot: '"'
        };

        return value.replace(/&(#(\d+)|#x([0-9a-f]+)|[a-z]+);/gi, (match, entity, decimal, hex) => {
            if (decimal) {
                return String.fromCodePoint(Number(decimal));
            }

            if (hex) {
                return String.fromCodePoint(parseInt(hex, 16));
            }

            return namedEntities[entity.toLowerCase()] ?? match;
        });
    }

    // Seed database with your complete reading data
    static async seedWithUserData(kindleFilePath?: string, readingListPath?: string): Promise<void> {
        console.log('Seeding database with your reading data...');

        try {
            // Check if data already exists
            const existingBooks = BookQueries.getAllBooks();
            if (existingBooks.length > 0) {
                console.log('Database already contains data, skipping seed');
                return;
            }

            // Parse Kindle highlights (completed books with highlights)
            let parsedBooks: ParsedBook[] = [];
            if (kindleFilePath) {
                parsedBooks = this.parseKindleHighlights(kindleFilePath);
            }

            // Parse reading list (future books to read)
            let futureBooks: CreateBookRequest[] = [];
            if (readingListPath) {
                futureBooks = this.parseReadingList(readingListPath);
            }

            // Prepare all books for cover fetching
            const allBooksForCovers = [
                ...parsedBooks.map(pb => ({ title: pb.title, authors: pb.authors })),
                ...futureBooks.map(fb => ({ title: fb.title, authors: fb.authors }))
            ];

            // Fetch covers for all books
            console.log('🎨 Fetching book covers...');
            const coverResults = await CoverService.processCoversForBooks(allBooksForCovers);
            const coverMap = new Map<string, CoverSearchResult>();
            coverResults.forEach(result => {
                coverMap.set(result.title, result);
            });

            let position = 1;

            // First, create completed books from Kindle highlights
            const completedBooks = [];
            for (const parsedBook of parsedBooks) {
                const coverResult = coverMap.get(parsedBook.title);
                
                // Create the book first
                const bookData: CreateBookRequest = {
                    title: parsedBook.title,
                    authors: parsedBook.authors,
                    position: position++
                };
                if (coverResult?.localPath) {
                    bookData.coverImageUrl = coverResult.localPath;
                }
                const book = BookQueries.createBook(bookData);

                // Then update it to completed status with additional data
                const updatedBook = BookQueries.updateBook(book.id, {
                    status: 'completed',
                    progressPercentage: 100,
                    completedDate: new Date().toISOString(),
                    personalRating: Math.floor(Math.random() * 2) + 4 // 4 or 5 stars for completed books
                });

                console.log(`Created completed book: ${book.title} (${parsedBook.highlights.length} highlights)${coverResult?.localPath ? ' 🎨' : ''}`);
                completedBooks.push(updatedBook);

                // Add highlights
                for (const highlightData of parsedBook.highlights) {
                    const highlight = HighlightQueries.createHighlight(book.id, highlightData);
                    console.log(`  Added highlight: ${highlight.quoteText.substring(0, 50)}...`);
                }
            }

            // Then, create future books from reading list
            const createdFutureBooks = [];
            for (const bookData of futureBooks) {
                const coverResult = coverMap.get(bookData.title);
                
                const finalBookData: CreateBookRequest = {
                    ...bookData,
                    position: position++
                };
                if (coverResult?.localPath) {
                    finalBookData.coverImageUrl = coverResult.localPath;
                }
                
                const book = BookQueries.createBook(finalBookData);
                console.log(`Created future book: ${book.title}${coverResult?.localPath ? ' 🎨' : ''}`);
                createdFutureBooks.push(book);
            }

            const totalCovers = coverResults.filter(r => r.localPath).length;
            console.log(`✅ Seeding completed successfully!`);
            console.log(`📚 Created ${completedBooks.length} completed books with highlights`);
            console.log(`📖 Created ${createdFutureBooks.length} books in your reading queue`);
            console.log(`🎨 Downloaded ${totalCovers}/${allBooksForCovers.length} book covers`);
            console.log(`🎯 Total books in your library: ${completedBooks.length + createdFutureBooks.length}`);
        } catch (error) {
            console.error('Failed to seed with user data:', error);
            throw error;
        }
    }

    // Seed database with reading list and Kindle highlights (legacy method)
    static async seedWithReadingList(kindleFilePath?: string): Promise<void> {
        console.log('Seeding database with reading list...');

        try {
            // Check if data already exists
            const existingBooks = BookQueries.getAllBooks();
            if (existingBooks.length > 0) {
                console.log('Database already contains data, skipping seed');
                return;
            }

            // Parse Kindle highlights if file provided
            let parsedBooks: ParsedBook[] = [];
            if (kindleFilePath) {
                parsedBooks = this.parseKindleHighlights(kindleFilePath);
            }

            // Create books from reading list
            const createdBooks = this.READING_LIST.map((bookData, index) => {
                const book = BookQueries.createBook({
                    ...bookData,
                    position: index + 1
                });
                console.log(`Created book: ${book.title}`);
                return book;
            });

            // Add highlights from Kindle file
            for (const book of createdBooks) {
                const parsedBook = parsedBooks.find(pb =>
                    pb.title.toLowerCase().includes(book.title.toLowerCase()) ||
                    book.title.toLowerCase().includes(pb.title.toLowerCase())
                );

                if (parsedBook && parsedBook.highlights.length > 0) {
                    console.log(`Adding ${parsedBook.highlights.length} highlights for "${book.title}"`);
                    for (const highlightData of parsedBook.highlights) {
                        const highlight = HighlightQueries.createHighlight(book.id, highlightData);
                        console.log(`  Added highlight: ${highlight.quoteText.substring(0, 50)}...`);
                    }
                }
            }

            console.log('Reading list seeding completed successfully');
        } catch (error) {
            console.error('Failed to seed with reading list:', error);
            throw error;
        }
    }

    // Seed the database with sample data
    static async seedDatabase(): Promise<void> {
        console.log('Seeding database with sample data...');

        try {
            // Check if data already exists
            const existingBooks = BookQueries.getAllBooks();
            if (existingBooks.length > 0) {
                console.log('Database already contains data, skipping seed');
                return;
            }

            // Fetch covers for sample books
            console.log('🎨 Fetching book covers...');
            const coverResults = await CoverService.processCoversForBooks(
                this.SAMPLE_BOOKS.map(book => ({ title: book.title, authors: book.authors }))
            );
            const coverMap = new Map<string, CoverSearchResult>();
            coverResults.forEach(result => {
                coverMap.set(result.title, result);
            });

            // Create sample books
            const createdBooks = this.SAMPLE_BOOKS.map((bookData, index) => {
                const coverResult = coverMap.get(bookData.title);
                const finalBookData: CreateBookRequest = {
                    ...bookData,
                    position: index + 1
                };
                if (coverResult?.localPath) {
                    finalBookData.coverImageUrl = coverResult.localPath;
                }
                const book = BookQueries.createBook(finalBookData);
                console.log(`Created book: ${book.title}${coverResult?.localPath ? ' 🎨' : ''}`);
                return book;
            });

            // Create sample highlights
            for (const book of createdBooks) {
                const highlights = this.SAMPLE_HIGHLIGHTS[book.title];
                if (highlights) {
                    for (const highlightData of highlights) {
                        const highlight = HighlightQueries.createHighlight(book.id, highlightData);
                        console.log(`Created highlight for "${book.title}": ${highlight.quoteText.substring(0, 50)}...`);
                    }
                }
            }

            const totalCovers = coverResults.filter(r => r.localPath).length;
            console.log('Database seeding completed successfully');
            console.log(`🎨 Downloaded ${totalCovers}/${this.SAMPLE_BOOKS.length} book covers`);
        } catch (error) {
            console.error('Failed to seed database:', error);
            throw error;
        }
    }

    // Clear all data from the database
    static clearDatabase(): void {
        console.log('Clearing database...');

        try {
            // Delete in correct order due to foreign key constraints
            const queries = [
                'DELETE FROM reading_sessions',
                'DELETE FROM highlights',
                'DELETE FROM books'
            ];

            for (const query of queries) {
                db.exec(query);
                console.log(`Executed: ${query}`);
            }

            console.log('Database cleared successfully');
        } catch (error) {
            console.error('Failed to clear database:', error);
            throw error;
        }
    }

    // Reset database (clear and seed)
    static async resetDatabase(): Promise<void> {
        this.clearDatabase();
        await this.seedDatabase();
    }

    // Reset database with reading list
    static async resetWithReadingList(kindleFilePath?: string): Promise<void> {
        this.clearDatabase();
        await this.seedWithReadingList(kindleFilePath);
    }

    // Create database backup
    static createBackup(backupPath?: string): string {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const defaultBackupPath = backupPath || `./data/backup-${timestamp}.db`;

        console.log(`Creating database backup: ${defaultBackupPath}`);

        try {
            // Get all data from tables
            const books = db.prepare('SELECT * FROM books ORDER BY position').all();
            const highlights = db.prepare('SELECT * FROM highlights ORDER BY book_id, id').all();
            const readingSessions = db.prepare('SELECT * FROM reading_sessions ORDER BY book_id, start_time').all();

            // Create backup data structure
            const backupData = {
                timestamp: new Date().toISOString(),
                version: '1.0',
                data: {
                    books,
                    highlights,
                    readingSessions
                }
            };

            // Write backup file
            writeFileSync(defaultBackupPath, JSON.stringify(backupData, null, 2));
            console.log(`Database backup created successfully: ${defaultBackupPath}`);

            return defaultBackupPath;
        } catch (error) {
            console.error('Failed to create database backup:', error);
            throw error;
        }
    }

    // Restore database from backup
    static restoreFromBackup(backupPath: string): void {
        console.log(`Restoring database from backup: ${backupPath}`);

        if (!existsSync(backupPath)) {
            throw new Error(`Backup file not found: ${backupPath}`);
        }

        try {
            // Read backup file
            const backupContent = readFileSync(backupPath, 'utf-8');
            const backupData = JSON.parse(backupContent);

            if (!backupData.data || !backupData.data.books) {
                throw new Error('Invalid backup file format');
            }

            // Clear existing data
            this.clearDatabase();

            // Restore books
            const insertBook = db.prepare(`
                INSERT INTO books (
                    id, title, authors, position, status, progress_percentage,
                    total_pages, current_page, started_date, completed_date,
                    personal_rating, personal_review, cover_image_url,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const book of backupData.data.books) {
                insertBook.run(
                    book.id, book.title, book.authors, book.position, book.status,
                    book.progress_percentage, book.total_pages, book.current_page,
                    book.started_date, book.completed_date, book.personal_rating,
                    book.personal_review, book.cover_image_url, book.created_at, book.updated_at
                );
            }

            // Restore highlights
            const insertHighlight = db.prepare(`
                INSERT INTO highlights (
                    id, book_id, quote_text, page_number, location,
                    personal_notes, highlight_date, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            for (const highlight of backupData.data.highlights) {
                insertHighlight.run(
                    highlight.id, highlight.book_id, highlight.quote_text,
                    highlight.page_number, highlight.location, highlight.personal_notes,
                    highlight.highlight_date, highlight.created_at, highlight.updated_at
                );
            }

            // Restore reading sessions
            const insertSession = db.prepare(`
                INSERT INTO reading_sessions (
                    id, book_id, start_time, end_time, pages_read, notes, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const session of backupData.data.readingSessions) {
                insertSession.run(
                    session.id, session.book_id, session.start_time,
                    session.end_time, session.pages_read, session.notes, session.created_at
                );
            }

            console.log(`Database restored successfully from backup: ${backupPath}`);
            console.log(`Restored ${backupData.data.books.length} books, ${backupData.data.highlights.length} highlights, ${backupData.data.readingSessions.length} reading sessions`);
        } catch (error) {
            console.error('Failed to restore database from backup:', error);
            throw error;
        }
    }

    // Add sample progress data for testing
    static addSampleProgressData(): void {
        console.log('Adding sample progress data...');

        try {
            const books = BookQueries.getAllBooks();

            if (books.length === 0) {
                console.log('No books found, skipping progress data');
                return;
            }

            // Add some sample progress to books
            const progressUpdates = [
                { status: 'completed', progress: 100, rating: 5 },
                { status: 'in_progress', progress: 45, rating: null },
                { status: 'in_progress', progress: 78, rating: null },
                { status: 'not_started', progress: 0, rating: null },
                { status: 'completed', progress: 100, rating: 4 },
                { status: 'not_started', progress: 0, rating: null }
            ];

            books.forEach((book, index) => {
                const update = progressUpdates[index % progressUpdates.length];
                if (!update) return;

                const updateData: any = {
                    status: update.status,
                    progressPercentage: update.progress
                };

                if (update.status === 'completed') {
                    updateData.completedDate = new Date().toISOString();
                    updateData.personalRating = update.rating;
                } else if (update.status === 'in_progress') {
                    updateData.startedDate = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString();
                    if (book.totalPages) {
                        updateData.currentPage = Math.floor((book.totalPages * update.progress) / 100);
                    }
                }

                BookQueries.updateBook(book.id, updateData);
                console.log(`Updated progress for "${book.title}": ${update.status} (${update.progress}%)`);
            });

            console.log('Sample progress data added successfully');
        } catch (error) {
            console.error('Failed to add sample progress data:', error);
            throw error;
        }
    }
}
