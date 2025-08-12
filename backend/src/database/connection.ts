import Database from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

export class DatabaseConnection {
    private static instance: DatabaseConnection;
    private db: Database.Database;

    private constructor() {
        const dbPath = process.env['DATABASE_PATH'] || './data/reading-tracker.db';
        this.db = new Database(dbPath);

        // Configure SQLite for Raspberry Pi optimization
        this.configureSQLiteForRaspberryPi();

        this.initializeSchema();
    }

    private configureSQLiteForRaspberryPi(): void {
        // Memory-optimized settings for Raspberry Pi
        const isRaspberryPi = process.arch === 'arm64' || process.env['RASPBERRY_PI'] === 'true';

        if (isRaspberryPi) {
            // Conservative settings for limited memory
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = -8192'); // 8MB cache (negative value = KB)
            this.db.pragma('temp_store = memory');
            this.db.pragma('mmap_size = 67108864'); // 64MB memory map
            this.db.pragma('page_size = 4096');
            this.db.pragma('wal_autocheckpoint = 1000');
            this.db.pragma('optimize');

            console.log('🍓 Database configured for Raspberry Pi with memory optimizations');
        } else {
            // Standard settings for development/other environments
            this.db.pragma('journal_mode = WAL');
            this.db.pragma('synchronous = NORMAL');
            this.db.pragma('cache_size = 2000');
            this.db.pragma('temp_store = memory');
            this.db.pragma('mmap_size = 134217728'); // 128MB memory map

            console.log('💻 Database configured with standard settings');
        }
    }

    public static getInstance(): DatabaseConnection {
        if (!DatabaseConnection.instance) {
            DatabaseConnection.instance = new DatabaseConnection();
        }
        return DatabaseConnection.instance;
    }

    public getDatabase(): Database.Database {
        return this.db;
    }

    private initializeSchema(): void {
        try {
            const schemaPath = join(__dirname, 'schema.sql');
            const schema = readFileSync(schemaPath, 'utf-8');
            this.db.exec(schema);
            console.log('Database schema initialized successfully');
        } catch (error) {
            console.error('Failed to initialize database schema:', error);
            throw error;
        }
    }

    public close(): void {
        this.db.close();
    }

    // Transaction helper
    public transaction<T>(fn: (db: Database.Database) => T): T {
        const transaction = this.db.transaction(fn);
        return transaction(this.db);
    }

    // Optimized query helpers for Raspberry Pi
    public prepareStatement(sql: string): Database.Statement {
        return this.db.prepare(sql);
    }

    // Memory-efficient batch operations
    public batchInsert<T>(statement: Database.Statement, data: T[]): void {
        const batchSize = process.arch === 'arm64' ? 50 : 100; // Smaller batches on Pi

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const transaction = this.db.transaction(() => {
                for (const item of batch) {
                    statement.run(item);
                }
            });
            transaction();
        }
    }

    // Periodic maintenance for Raspberry Pi
    public performMaintenance(): void {
        try {
            // Analyze tables for query optimization
            this.db.pragma('analyze');

            // Optimize database
            this.db.pragma('optimize');

            // Checkpoint WAL file to reduce size
            this.db.pragma('wal_checkpoint(TRUNCATE)');

            console.log('🔧 Database maintenance completed');
        } catch (error) {
            console.error('Database maintenance failed:', error);
        }
    }

    // Get database statistics
    public getStats(): {
        pageCount: number;
        pageSize: number;
        cacheSize: number;
        walSize: number;
        totalSizeMB: number;
    } | null {
        try {
            const pageCount = this.db.pragma('page_count', { simple: true }) as number;
            const pageSize = this.db.pragma('page_size', { simple: true }) as number;
            const cacheSize = this.db.pragma('cache_size', { simple: true }) as number;
            const walSize = this.db.pragma('wal_autocheckpoint', { simple: true }) as number;

            return {
                pageCount,
                pageSize,
                cacheSize,
                walSize,
                totalSizeMB: Math.round((pageCount * pageSize) / 1024 / 1024 * 100) / 100
            };
        } catch (error) {
            console.error('Failed to get database stats:', error);
            return null;
        }
    }
}

// Export singleton instance
export const db: Database.Database = DatabaseConnection.getInstance().getDatabase();

// Export function for testing
export const getDatabase = (): Database.Database => {
    return DatabaseConnection.getInstance().getDatabase();
};