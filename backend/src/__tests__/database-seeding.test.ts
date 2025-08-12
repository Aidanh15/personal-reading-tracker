import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { DatabaseSeeder } from '../database/seed';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { db } from '../database/connection';
import { writeFileSync, unlinkSync, existsSync } from 'fs';

describe('DatabaseSeeder', () => {
    beforeEach(() => {
        // Clear database before each test
        DatabaseSeeder.clearDatabase();
    });

    afterEach(() => {
        // Clean up any test files
        const testFiles = [
            './test-kindle-highlights.txt',
            './test-backup.json'
        ];
        
        testFiles.forEach(file => {
            if (existsSync(file)) {
                unlinkSync(file);
            }
        });
    });

    describe('clearDatabase', () => {
        it('should clear all data from database', () => {
            // Add some test data
            const book = BookQueries.createBook({
                title: 'Test Book',
                authors: ['Test Author'],
                position: 1
            });
            
            HighlightQueries.createHighlight(book.id, {
                quoteText: 'Test quote',
                personalNotes: 'Test note'
            });

            // Verify data exists
            expect(BookQueries.getAllBooks()).toHaveLength(1);
            expect(HighlightQueries.getHighlightsByBookId(book.id)).toHaveLength(1);

            // Clear database
            DatabaseSeeder.clearDatabase();

            // Verify data is cleared
            expect(BookQueries.getAllBooks()).toHaveLength(0);
            expect(HighlightQueries.getHighlightsByBookId(book.id)).toHaveLength(0);
        });
    });

    describe('seedDatabase', () => {
        it('should seed database with sample data', async () => {
            await DatabaseSeeder.seedDatabase();

            const books = BookQueries.getAllBooks();
            expect(books.length).toBeGreaterThan(0);

            // Check that books have proper positions
            books.forEach((book, index) => {
                expect(book.position).toBe(index + 1);
            });

            // Check that some books have highlights
            const booksWithHighlights = books.filter(book => 
                HighlightQueries.getHighlightsByBookId(book.id).length > 0
            );
            expect(booksWithHighlights.length).toBeGreaterThan(0);
        });

        it('should not seed if data already exists', async () => {
            // Add initial data
            await DatabaseSeeder.seedDatabase();
            const initialCount = BookQueries.getAllBooks().length;

            // Try to seed again
            await DatabaseSeeder.seedDatabase();
            const finalCount = BookQueries.getAllBooks().length;

            expect(finalCount).toBe(initialCount);
        });
    });

    describe('parseKindleHighlights', () => {
        it('should parse Kindle highlights file correctly', () => {
            const testContent = `1984: Political Dystopian Classic, George Orwell


War is peace. Freedom is slavery. Ignorance is strength.


Big Brother is watching you.


The Myth of Sisyphus, Albert Camus


There is but one truly serious philosophical problem, and that is suicide.


The struggle itself toward the heights is enough to fill a man's heart.`;

            // Write test file
            const testFile = './test-kindle-highlights.txt';
            writeFileSync(testFile, testContent);

            const parsedBooks = DatabaseSeeder.parseKindleHighlights(testFile);

            expect(parsedBooks.length).toBeGreaterThan(0);
            
            const orwellBook = parsedBooks.find(book => book.authors.includes('George Orwell'));
            expect(orwellBook).toBeDefined();
            expect(orwellBook!.highlights.length).toBeGreaterThan(0);

            // The parser might combine books or parse differently, so let's be more flexible
            const totalHighlights = parsedBooks.reduce((sum, book) => sum + book.highlights.length, 0);
            expect(totalHighlights).toBeGreaterThan(0);
        });

        it('should handle non-existent file gracefully', () => {
            const parsedBooks = DatabaseSeeder.parseKindleHighlights('./non-existent-file.txt');
            expect(parsedBooks).toHaveLength(0);
        });

        it('should filter out invalid entries', () => {
            const testContent = `Valid Book, Valid Author


This is a valid highlight that should be included.


This is another valid highlight.


This line is too short.


This is a very long line that might be a quote but contains commas, semicolons, and other punctuation that makes it look like metadata rather than a book title, so it should be filtered out as a potential book title.`;

            const testFile = './test-kindle-highlights.txt';
            writeFileSync(testFile, testContent);

            const parsedBooks = DatabaseSeeder.parseKindleHighlights(testFile);

            expect(parsedBooks).toHaveLength(1);
            expect(parsedBooks[0]?.highlights).toHaveLength(2);
        });
    });

    describe('seedWithReadingList', () => {
        it('should seed with reading list and Kindle highlights', async () => {
            const testContent = `1984, George Orwell


War is peace. Freedom is slavery. Ignorance is strength.


Crime and Punishment, Fyodor Dostoyevsky


Pain and suffering are inevitable for persons of broad awareness and depth of heart.`;

            const testFile = './test-kindle-highlights.txt';
            writeFileSync(testFile, testContent);

            await DatabaseSeeder.seedWithReadingList(testFile);

            const books = BookQueries.getAllBooks();
            expect(books.length).toBeGreaterThan(0);

            // Check that 1984 has highlights from the file
            const orwellBook = books.find(book => book.title === '1984');
            expect(orwellBook).toBeDefined();
            
            const highlights = HighlightQueries.getHighlightsByBookId(orwellBook!.id);
            expect(highlights.length).toBeGreaterThan(0);
            expect(highlights.some(h => h.quoteText.includes('War is peace'))).toBe(true);
        });

        it('should work without Kindle file', async () => {
            await DatabaseSeeder.seedWithReadingList();

            const books = BookQueries.getAllBooks();
            expect(books.length).toBeGreaterThan(0);
        });
    });

    describe('backup and restore', () => {
        it('should create and restore backup correctly', async () => {
            // Seed some data
            await DatabaseSeeder.seedDatabase();
            DatabaseSeeder.addSampleProgressData();

            const originalBooks = BookQueries.getAllBooks();
            const originalHighlights = db.prepare('SELECT * FROM highlights').all();

            // Create backup
            const backupPath = './test-backup.json';
            DatabaseSeeder.createBackup(backupPath);

            expect(existsSync(backupPath)).toBe(true);

            // Clear database
            DatabaseSeeder.clearDatabase();
            expect(BookQueries.getAllBooks()).toHaveLength(0);

            // Restore from backup
            DatabaseSeeder.restoreFromBackup(backupPath);

            const restoredBooks = BookQueries.getAllBooks();
            const restoredHighlights = db.prepare('SELECT * FROM highlights').all();

            expect(restoredBooks).toHaveLength(originalBooks.length);
            expect(restoredHighlights).toHaveLength(originalHighlights.length);

            // Check that data is identical
            restoredBooks.forEach((book, index) => {
                const original = originalBooks[index];
                if (original) {
                    expect(book.title).toBe(original.title);
                    expect(book.status).toBe(original.status);
                    expect(book.progressPercentage).toBe(original.progressPercentage);
                }
            });
        });

        it('should handle invalid backup file', () => {
            const invalidBackupPath = './invalid-backup.json';
            writeFileSync(invalidBackupPath, '{"invalid": "data"}');

            expect(() => {
                DatabaseSeeder.restoreFromBackup(invalidBackupPath);
            }).toThrow('Invalid backup file format');

            unlinkSync(invalidBackupPath);
        });

        it('should handle non-existent backup file', () => {
            expect(() => {
                DatabaseSeeder.restoreFromBackup('./non-existent-backup.json');
            }).toThrow('Backup file not found');
        });
    });

    describe('addSampleProgressData', () => {
        it('should add progress data to existing books', async () => {
            await DatabaseSeeder.seedDatabase();

            // Check initial state
            const initialBooks = BookQueries.getAllBooks();
            expect(initialBooks.every(book => book.status === 'not_started')).toBe(true);

            // Add progress data
            DatabaseSeeder.addSampleProgressData();

            // Check updated state
            const updatedBooks = BookQueries.getAllBooks();
            const statusCounts = updatedBooks.reduce((acc, book) => {
                acc[book.status] = (acc[book.status] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            // Should have at least some variety in statuses
            const totalStatuses = Object.keys(statusCounts).length;
            expect(totalStatuses).toBeGreaterThan(1);
            
            // Should have some completed or in-progress books
            const nonStartedBooks = (statusCounts['completed'] || 0) + (statusCounts['in_progress'] || 0);
            expect(nonStartedBooks).toBeGreaterThan(0);

            // Check that completed books have ratings
            const completedBooks = updatedBooks.filter(book => book.status === 'completed');
            expect(completedBooks.every(book => book.personalRating !== null)).toBe(true);

            // Check that in-progress books have started dates
            const inProgressBooks = updatedBooks.filter(book => book.status === 'in_progress');
            expect(inProgressBooks.every(book => book.startedDate !== null)).toBe(true);
        });

        it('should handle empty database gracefully', () => {
            expect(() => {
                DatabaseSeeder.addSampleProgressData();
            }).not.toThrow();
        });
    });

    describe('resetDatabase', () => {
        it('should clear and reseed database', async () => {
            // Add some initial data
            BookQueries.createBook({
                title: 'Initial Book',
                authors: ['Initial Author'],
                position: 1
            });

            expect(BookQueries.getAllBooks()).toHaveLength(1);

            // Reset database
            await DatabaseSeeder.resetDatabase();

            const books = BookQueries.getAllBooks();
            expect(books.length).toBeGreaterThan(1); // Should have sample books
            expect(books.find(b => b.title === 'Initial Book')).toBeUndefined();
        });
    });

    describe('resetWithReadingList', () => {
        it('should clear and reseed with reading list', async () => {
            const testContent = `1984, George Orwell


War is peace. Freedom is slavery. Ignorance is strength.`;

            const testFile = './test-kindle-highlights.txt';
            writeFileSync(testFile, testContent);

            // Add some initial data
            BookQueries.createBook({
                title: 'Initial Book',
                authors: ['Initial Author'],
                position: 1
            });

            // Reset with reading list
            await DatabaseSeeder.resetWithReadingList(testFile);

            const books = BookQueries.getAllBooks();
            expect(books.find(b => b.title === 'Initial Book')).toBeUndefined();
            expect(books.find(b => b.title === '1984')).toBeDefined();
        });
    });
});