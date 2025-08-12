import { BookQueries } from './queries/books';
import { HighlightQueries } from './queries/highlights';
import { CreateBookRequest, CreateHighlightRequest } from '../types';
import { db } from './connection';
import { readFileSync, writeFileSync, existsSync } from 'fs';

interface ParsedBook {
    title: string;
    authors: string[];
    highlights: CreateHighlightRequest[];
}

export class DatabaseSeeder {
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

    // Parse Kindle highlights from text file
    static parseKindleHighlights(filePath: string): ParsedBook[] {
        console.log(`Parsing Kindle highlights from: ${filePath}`);
        
        if (!existsSync(filePath)) {
            console.warn(`Kindle highlights file not found: ${filePath}`);
            return [];
        }

        try {
            const content = readFileSync(filePath, 'utf-8');
            const lines = content.split('\n').map(line => line.trim()).filter(line => line);
            
            const books: Map<string, ParsedBook> = new Map();
            let currentBook: string | null = null;
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                if (!line) continue;
                
                // Check if this line is a book title and author (contains comma and looks like "Title, Author")
                if (line.includes(',') && !currentBook) {
                    const parts = line.split(',');
                    if (parts.length >= 2 && parts[0]) {
                        const title = parts[0].trim();
                        const author = parts.slice(1).join(',').trim();
                        
                        // Skip if this looks like a quote rather than a title
                        if (title.length > 100 || line.includes('"') || line.includes("'")) {
                            continue;
                        }
                        
                        currentBook = title;
                        
                        if (!books.has(title)) {
                            books.set(title, {
                                title,
                                authors: [author],
                                highlights: []
                            });
                        }
                        continue;
                    }
                }
                
                // Check for title: subtitle, author format
                if (line.includes(':') && line.includes(',') && !currentBook) {
                    const colonIndex = line.indexOf(':');
                    const commaIndex = line.lastIndexOf(',');
                    
                    if (commaIndex > colonIndex) {
                        const fullTitle = line.substring(0, commaIndex).trim();
                        const author = line.substring(commaIndex + 1).trim();
                        
                        // Skip if this looks like a quote
                        if (fullTitle.length > 150 || line.includes('"') || line.includes("'")) {
                            continue;
                        }
                        
                        currentBook = fullTitle;
                        
                        if (!books.has(fullTitle)) {
                            books.set(fullTitle, {
                                title: fullTitle,
                                authors: [author],
                                highlights: []
                            });
                        }
                        continue;
                    }
                }
                
                // If we have a current book and this line looks like a highlight
                if (currentBook && line.length > 20 && !line.includes(',') && books.has(currentBook)) {
                    const book = books.get(currentBook)!;
                    
                    // Skip very short lines or lines that look like metadata
                    if (line.length < 30 || line.match(/^(page|location|added on)/i)) {
                        continue;
                    }
                    
                    book.highlights.push({
                        quoteText: line,
                        personalNotes: `Imported from Kindle highlights`
                    });
                }
                
                // Reset current book after empty line or when we hit another book
                if (!line || (line.includes(',') && line.length < 100)) {
                    currentBook = null;
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

    // Seed database with reading list and Kindle highlights
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

            // Create sample books
            const createdBooks = this.SAMPLE_BOOKS.map((bookData, index) => {
                const book = BookQueries.createBook({
                    ...bookData,
                    position: index + 1
                });
                console.log(`Created book: ${book.title}`);
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

            console.log('Database seeding completed successfully');
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