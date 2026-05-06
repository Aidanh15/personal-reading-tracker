-- Personal Reading Tracker Database Schema

-- Books table: Core book information and reading progress
CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    authors TEXT NOT NULL, -- JSON array of author names
    position INTEGER NOT NULL DEFAULT 0, -- Position in reading order
    status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
    progress_percentage INTEGER DEFAULT 0 CHECK (progress_percentage >= 0 AND progress_percentage <= 100),
    total_pages INTEGER CHECK (total_pages > 0),
    current_page INTEGER DEFAULT 0 CHECK (current_page >= 0),
    started_date TEXT, -- ISO date string
    completed_date TEXT, -- ISO date string
    personal_rating INTEGER CHECK (personal_rating >= 1 AND personal_rating <= 5),
    personal_review TEXT,
    cover_image_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Highlights table: Book highlights and personal notes
CREATE TABLE IF NOT EXISTS highlights (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    quote_text TEXT NOT NULL,
    page_number INTEGER CHECK (page_number > 0),
    location TEXT, -- Kindle location or chapter reference
    personal_notes TEXT,
    highlight_date TEXT, -- When originally highlighted (ISO date string)
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);

-- Reading sessions table: Detailed reading session tracking
CREATE TABLE IF NOT EXISTS reading_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    book_id INTEGER NOT NULL,
    start_time TEXT NOT NULL, -- ISO datetime string
    end_time TEXT, -- ISO datetime string
    pages_read INTEGER DEFAULT 0 CHECK (pages_read >= 0),
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (book_id) REFERENCES books (id) ON DELETE CASCADE
);

-- Highlight review state: Local Readwise-style daily quote review
CREATE TABLE IF NOT EXISTS highlight_reviews (
    highlight_id INTEGER PRIMARY KEY,
    last_reviewed_at TEXT,
    next_review_at TEXT,
    review_count INTEGER DEFAULT 0 CHECK (review_count >= 0),
    favorite INTEGER DEFAULT 0 CHECK (favorite IN (0, 1)),
    archived INTEGER DEFAULT 0 CHECK (archived IN (0, 1)),
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (highlight_id) REFERENCES highlights (id) ON DELETE CASCADE
);

-- Daily review queue: fixed random set of highlights for each day
CREATE TABLE IF NOT EXISTS daily_review_queue (
    review_date TEXT NOT NULL,
    highlight_id INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (review_date, highlight_id),
    FOREIGN KEY (highlight_id) REFERENCES highlights (id) ON DELETE CASCADE
);

-- Indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_books_status ON books (status);
CREATE INDEX IF NOT EXISTS idx_books_position ON books (position);
CREATE INDEX IF NOT EXISTS idx_highlights_book_id ON highlights (book_id);
CREATE INDEX IF NOT EXISTS idx_reading_sessions_book_id ON reading_sessions (book_id);
CREATE INDEX IF NOT EXISTS idx_books_title ON books (title);
CREATE INDEX IF NOT EXISTS idx_highlights_quote_text ON highlights (quote_text);
CREATE INDEX IF NOT EXISTS idx_highlight_reviews_next_review ON highlight_reviews (next_review_at, archived);
CREATE INDEX IF NOT EXISTS idx_highlight_reviews_favorite ON highlight_reviews (favorite);
CREATE INDEX IF NOT EXISTS idx_daily_review_queue_date ON daily_review_queue (review_date, sort_order);

-- Triggers to automatically update the updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_books_timestamp 
    AFTER UPDATE ON books
    FOR EACH ROW
    BEGIN
        UPDATE books SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_highlights_timestamp 
    AFTER UPDATE ON highlights
    FOR EACH ROW
    BEGIN
        UPDATE highlights SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
    END;

CREATE TRIGGER IF NOT EXISTS update_highlight_reviews_timestamp
    AFTER UPDATE ON highlight_reviews
    FOR EACH ROW
    BEGIN
        UPDATE highlight_reviews SET updated_at = CURRENT_TIMESTAMP WHERE highlight_id = NEW.highlight_id;
    END;
