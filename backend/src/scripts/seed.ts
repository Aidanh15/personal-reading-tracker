#!/usr/bin/env tsx

import { DatabaseSeeder } from '../database/seed';
import { join } from 'path';

// CLI script for database seeding operations
async function main() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
        switch (command) {
            case 'seed':
                console.log('🌱 Seeding database with sample data...');
                await DatabaseSeeder.seedDatabase();
                break;

            case 'seed-reading-list':
                const kindleFile = args[1] || join(process.cwd(), '../../KindleHighlights.txt');
                console.log('📚 Seeding database with reading list...');
                console.log(`Using Kindle highlights file: ${kindleFile}`);
                await DatabaseSeeder.seedWithReadingList(kindleFile);
                break;

            case 'clear':
                console.log('🧹 Clearing database...');
                DatabaseSeeder.clearDatabase();
                break;

            case 'reset':
                console.log('🔄 Resetting database with sample data...');
                await DatabaseSeeder.resetDatabase();
                break;

            case 'reset-reading-list':
                const kindleFileReset = args[1] || join(process.cwd(), '../../KindleHighlights.txt');
                console.log('🔄 Resetting database with reading list...');
                console.log(`Using Kindle highlights file: ${kindleFileReset}`);
                await DatabaseSeeder.resetWithReadingList(kindleFileReset);
                break;

            case 'backup':
                const backupPath = args[1];
                console.log('💾 Creating database backup...');
                const createdBackup = DatabaseSeeder.createBackup(backupPath);
                console.log(`✅ Backup created: ${createdBackup}`);
                break;

            case 'restore':
                const restorePath = args[1];
                if (!restorePath) {
                    console.error('❌ Please provide backup file path');
                    process.exit(1);
                }
                console.log('📥 Restoring database from backup...');
                DatabaseSeeder.restoreFromBackup(restorePath);
                console.log('✅ Database restored successfully');
                break;

            case 'add-progress':
                console.log('📊 Adding sample progress data...');
                DatabaseSeeder.addSampleProgressData();
                break;

            case 'parse-kindle':
                const parseFile = args[1] || join(process.cwd(), '../../KindleHighlights.txt');
                console.log('📖 Parsing Kindle highlights file...');
                const parsedBooks = DatabaseSeeder.parseKindleHighlights(parseFile);
                console.log(`Found ${parsedBooks.length} books with highlights:`);
                parsedBooks.forEach(book => {
                    console.log(`  - ${book.title} by ${book.authors.join(', ')} (${book.highlights.length} highlights)`);
                });
                break;

            default:
                console.log(`
📚 Personal Reading Tracker - Database Seeding CLI

Usage: tsx seed.ts <command> [options]

Commands:
  seed                    Seed database with sample data
  seed-reading-list [file] Seed with reading list and Kindle highlights
  clear                   Clear all data from database
  reset                   Clear and seed with sample data
  reset-reading-list [file] Clear and seed with reading list
  backup [path]           Create database backup
  restore <path>          Restore database from backup
  add-progress            Add sample progress data to existing books
  parse-kindle [file]     Parse and display Kindle highlights (dry run)

Examples:
  tsx seed.ts seed-reading-list
  tsx seed.ts seed-reading-list ./path/to/KindleHighlights.txt
  tsx seed.ts backup ./backups/my-backup.json
  tsx seed.ts restore ./backups/my-backup.json
  tsx seed.ts parse-kindle
                `);
                break;
        }
    } catch (error) {
        console.error('❌ Error:', error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

main();