import { db } from './connection';
import { readFileSync, readdirSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';

interface Migration {
    id: number;
    name: string;
    filename: string;
    appliedAt?: string;
}

export class MigrationManager {
    private static readonly MIGRATIONS_TABLE = 'migrations';
    private static readonly MIGRATIONS_DIR = join(__dirname, 'migrations');

    // Initialize migrations table
    static initializeMigrationsTable(): void {
        const query = `
      CREATE TABLE IF NOT EXISTS ${this.MIGRATIONS_TABLE} (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        filename TEXT NOT NULL,
        applied_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `;
        db.exec(query);
    }

    // Get applied migrations
    static getAppliedMigrations(): Migration[] {
        this.initializeMigrationsTable();

        const query = `
      SELECT id, name, filename, applied_at as appliedAt 
      FROM ${this.MIGRATIONS_TABLE} 
      ORDER BY id ASC
    `;

        return db.prepare(query).all() as Migration[];
    }

    // Get pending migrations
    static getPendingMigrations(): Migration[] {
        const appliedMigrations = this.getAppliedMigrations();
        const appliedIds = new Set(appliedMigrations.map(m => m.id));

        try {
            const migrationFiles = readdirSync(this.MIGRATIONS_DIR)
                .filter(file => file.endsWith('.sql'))
                .sort();

            const allMigrations: Migration[] = migrationFiles.map(filename => {
                const match = filename.match(/^(\d+)_(.+)\.sql$/);
                if (!match || !match[1] || !match[2]) {
                    throw new Error(`Invalid migration filename: ${filename}`);
                }

                return {
                    id: parseInt(match[1], 10),
                    name: match[2].replace(/_/g, ' '),
                    filename
                };
            });

            return allMigrations.filter(migration => !appliedIds.has(migration.id));
        } catch (error) {
            // Migrations directory doesn't exist or is empty
            return [];
        }
    }

    // Apply a single migration
    static applyMigration(migration: Migration): void {
        const migrationPath = join(this.MIGRATIONS_DIR, migration.filename);
        const sql = readFileSync(migrationPath, 'utf-8');

        const transaction = db.transaction(() => {
            // Execute migration SQL
            db.exec(sql);

            // Record migration as applied
            const insertQuery = `
        INSERT INTO ${this.MIGRATIONS_TABLE} (id, name, filename)
        VALUES (?, ?, ?)
      `;
            db.prepare(insertQuery).run(migration.id, migration.name, migration.filename);
        });

        transaction();
        console.log(`Applied migration: ${migration.filename}`);
    }

    // Apply all pending migrations
    static applyPendingMigrations(): void {
        const pendingMigrations = this.getPendingMigrations();

        if (pendingMigrations.length === 0) {
            console.log('No pending migrations');
            return;
        }

        console.log(`Applying ${pendingMigrations.length} pending migrations...`);

        for (const migration of pendingMigrations) {
            this.applyMigration(migration);
        }

        console.log('All migrations applied successfully');
    }

    // Create a new migration file
    static createMigration(name: string): string {
        const timestamp = Date.now();
        const filename = `${timestamp}_${name.replace(/\s+/g, '_').toLowerCase()}.sql`;
        const migrationPath = join(this.MIGRATIONS_DIR, filename);

        const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- Add your migration SQL here

`;

        try {
            // Create migrations directory if it doesn't exist
            if (!existsSync(this.MIGRATIONS_DIR)) {
                mkdirSync(this.MIGRATIONS_DIR, { recursive: true });
            }

            writeFileSync(migrationPath, template);
            console.log(`Created migration: ${filename}`);
            return migrationPath;
        } catch (error) {
            console.error('Failed to create migration:', error);
            throw error;
        }
    }
}