import { existsSync, readdirSync, readFileSync, statSync } from 'fs';
import { extname, join } from 'path';
import { db } from '../database/connection';
import { DatabaseSeeder, KindleImportStats } from '../database/seed';

/**
 * Imports Kindle highlights from a folder of clippings.io Markdown exports
 * (one file per book). The folder is kept in sync from Google Drive on the
 * host (rclone); clippings.io Auto Export rewrites a book's file whenever it
 * gains highlights. Only new or changed files are read, and the importer skips
 * highlights already stored, so re-reading a file never duplicates anything.
 */

const MARKDOWN = new Set(['.md', '.markdown']);

export interface ClippingsSyncResult {
    ranAt: string;
    directory: string;
    filesSeen: number;
    filesImported: number;
    highlightsImported: number;
    booksCreated: number;
    error?: string;
}

let lastResult: ClippingsSyncResult | null = null;

export function getClippingsSyncDirectory(): string {
    return process.env['CLIPPINGS_SYNC_DIR'] || join(process.cwd(), 'imports', 'clippings');
}

export function getLastClippingsSync(): ClippingsSyncResult | null {
    return lastResult;
}

function ensureTable(): void {
    db.exec(`
        CREATE TABLE IF NOT EXISTS clippings_sync_files (
            file_name TEXT PRIMARY KEY,
            size INTEGER NOT NULL,
            mtime_ms INTEGER NOT NULL,
            imported_at TEXT NOT NULL,
            highlights_imported INTEGER NOT NULL DEFAULT 0
        )
    `);
}

export function syncClippingsFolder(directory = getClippingsSyncDirectory()): ClippingsSyncResult {
    const result: ClippingsSyncResult = {
        ranAt: new Date().toISOString(), directory, filesSeen: 0, filesImported: 0, highlightsImported: 0, booksCreated: 0
    };

    try {
        if (!existsSync(directory)) {
            result.error = 'Sync folder not found';
            return (lastResult = result);
        }
        ensureTable();

        const known = db.prepare('SELECT size, mtime_ms AS mtimeMs FROM clippings_sync_files WHERE file_name = ?');
        const record = db.prepare(`
            INSERT INTO clippings_sync_files (file_name, size, mtime_ms, imported_at, highlights_imported)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(file_name) DO UPDATE SET
                size = excluded.size, mtime_ms = excluded.mtime_ms,
                imported_at = excluded.imported_at, highlights_imported = excluded.highlights_imported
        `);

        for (const fileName of readdirSync(directory)) {
            if (!MARKDOWN.has(extname(fileName).toLowerCase())) continue;
            const path = join(directory, fileName);
            const stats = statSync(path);
            if (!stats.isFile()) continue;
            result.filesSeen += 1;

            const previous = known.get(fileName) as { size: number; mtimeMs: number } | undefined;
            const mtimeMs = Math.floor(stats.mtimeMs);
            if (previous && previous.size === stats.size && previous.mtimeMs === mtimeMs) continue;

            const parsed = DatabaseSeeder.parseKindleMarkdownFile(fileName, readFileSync(path, 'utf-8'));
            let imported: KindleImportStats | null = null;
            if (parsed) imported = DatabaseSeeder.importParsedBooks([parsed]);

            record.run(fileName, stats.size, mtimeMs, new Date().toISOString(), imported?.highlightsImported ?? 0);
            result.filesImported += 1;
            result.highlightsImported += imported?.highlightsImported ?? 0;
            result.booksCreated += imported?.booksCreated ?? 0;
        }
    } catch (error) {
        result.error = error instanceof Error ? error.message : String(error);
        console.error('Clippings sync failed:', error);
    }

    if (result.highlightsImported > 0 || result.error) {
        console.log(`Clippings sync: ${result.highlightsImported} new highlights from ${result.filesImported} changed files` +
            (result.error ? ` (error: ${result.error})` : ''));
    }
    return (lastResult = result);
}

/**
 * Runs the sync shortly after startup and then once a day (CLIPPINGS_SYNC_MINUTES, default 1440; 0 disables).
 * Highlights reach clippings.io roughly weekly (its import only works on desktop), so daily is plenty.
 */
export function startClippingsSync(): void {
    const minutes = Number(process.env['CLIPPINGS_SYNC_MINUTES'] ?? 1440);
    if (!Number.isFinite(minutes) || minutes <= 0) {
        console.log('Clippings sync disabled');
        return;
    }

    console.log(`Clippings sync: watching ${getClippingsSyncDirectory()} every ${minutes} min`);
    setTimeout(() => syncClippingsFolder(), 60_000).unref();
    setInterval(() => syncClippingsFolder(), minutes * 60_000).unref();
}
