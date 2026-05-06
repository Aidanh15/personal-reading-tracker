import { db } from '../connection';
import { ReviewAction, ReviewHighlight, ReviewSummary } from '../../types';

type ReviewRow = Omit<ReviewHighlight, 'bookAuthors' | 'favorite'> & {
  bookAuthors: string;
  favorite: number;
};

export class ReviewQueries {
  private static readonly DAILY_REVIEW_LIMIT = 12;
  private static readonly DEFAULT_READ_INTERVAL_DAYS = 14;
  private static readonly LATER_INTERVAL_DAYS = 1;

  static getDueHighlights(limit = ReviewQueries.DAILY_REVIEW_LIMIT): ReviewHighlight[] {
    const dailyLimit = this.getDailyLimit(limit);
    this.ensureDailyQueue(dailyLimit);

    const query = `
      SELECT
        h.id,
        h.book_id as bookId,
        h.quote_text as quoteText,
        h.page_number as pageNumber,
        h.location,
        h.personal_notes as personalNotes,
        h.highlight_date as highlightDate,
        h.created_at as createdAt,
        h.updated_at as updatedAt,
        b.title as bookTitle,
        b.authors as bookAuthors,
        hr.last_reviewed_at as lastReviewedAt,
        hr.next_review_at as nextReviewAt,
        COALESCE(hr.review_count, 0) as reviewCount,
        COALESCE(hr.favorite, 0) as favorite
      FROM highlights h
      JOIN books b ON h.book_id = b.id
      JOIN daily_review_queue dq ON dq.highlight_id = h.id
      LEFT JOIN highlight_reviews hr ON hr.highlight_id = h.id
      WHERE dq.review_date = date('now')
        AND COALESCE(hr.archived, 0) = 0
        AND (
          hr.last_reviewed_at IS NULL
          OR date(hr.last_reviewed_at) < date('now')
        )
      ORDER BY dq.sort_order ASC, h.id ASC
      LIMIT ?
    `;

    const rows = db.prepare(query).all(dailyLimit) as ReviewRow[];
    return rows.map(this.mapReviewRow);
  }

  static getSummary(): ReviewSummary {
    this.ensureDailyQueue(this.DAILY_REVIEW_LIMIT);

    const totalHighlights = db.prepare('SELECT COUNT(*) as count FROM highlights').get() as { count: number };
    const due = db.prepare(`
      SELECT COUNT(*) as count
      FROM daily_review_queue dq
      JOIN highlights h ON h.id = dq.highlight_id
      LEFT JOIN highlight_reviews hr ON hr.highlight_id = h.id
      WHERE dq.review_date = date('now')
        AND COALESCE(hr.archived, 0) = 0
        AND (
          hr.last_reviewed_at IS NULL
          OR date(hr.last_reviewed_at) < date('now')
        )
    `).get() as { count: number };
    const reviewedToday = db.prepare(`
      SELECT COUNT(*) as count
      FROM daily_review_queue dq
      LEFT JOIN highlight_reviews hr ON hr.highlight_id = dq.highlight_id
      WHERE dq.review_date = date('now')
        AND (
          date(hr.last_reviewed_at) = date('now')
          OR COALESCE(hr.archived, 0) = 1
        )
    `).get() as { count: number };
    const favorite = db.prepare(`
      SELECT COUNT(*) as count
      FROM highlight_reviews
      WHERE favorite = 1
    `).get() as { count: number };
    const archived = db.prepare(`
      SELECT COUNT(*) as count
      FROM highlight_reviews
      WHERE archived = 1
    `).get() as { count: number };

    return {
      totalHighlights: totalHighlights.count,
      dueCount: due.count,
      reviewedToday: reviewedToday.count,
      favoriteCount: favorite.count,
      archivedCount: archived.count
    };
  }

  static recordAction(highlightId: number, action: ReviewAction): ReviewHighlight | null {
    const existing = db.prepare('SELECT id FROM highlights WHERE id = ?').get(highlightId);
    if (!existing) {
      return null;
    }

    switch (action) {
      case 'read':
        this.upsertReview(highlightId, this.DEFAULT_READ_INTERVAL_DAYS, true);
        break;
      case 'later':
        this.upsertReview(highlightId, this.LATER_INTERVAL_DAYS, false);
        break;
      case 'favorite':
        this.ensureReview(highlightId);
        db.prepare(`
          UPDATE highlight_reviews
          SET favorite = CASE favorite WHEN 1 THEN 0 ELSE 1 END
          WHERE highlight_id = ?
        `).run(highlightId);
        break;
      case 'archive':
        this.ensureReview(highlightId);
        db.prepare(`
          UPDATE highlight_reviews
          SET
            archived = 1,
            last_reviewed_at = CURRENT_TIMESTAMP
          WHERE highlight_id = ?
        `).run(highlightId);
        break;
    }

    return this.getReviewHighlight(highlightId);
  }

  private static getReviewHighlight(highlightId: number): ReviewHighlight | null {
    const query = `
      SELECT
        h.id,
        h.book_id as bookId,
        h.quote_text as quoteText,
        h.page_number as pageNumber,
        h.location,
        h.personal_notes as personalNotes,
        h.highlight_date as highlightDate,
        h.created_at as createdAt,
        h.updated_at as updatedAt,
        b.title as bookTitle,
        b.authors as bookAuthors,
        hr.last_reviewed_at as lastReviewedAt,
        hr.next_review_at as nextReviewAt,
        COALESCE(hr.review_count, 0) as reviewCount,
        COALESCE(hr.favorite, 0) as favorite
      FROM highlights h
      JOIN books b ON h.book_id = b.id
      LEFT JOIN highlight_reviews hr ON hr.highlight_id = h.id
      WHERE h.id = ?
    `;

    const row = db.prepare(query).get(highlightId) as ReviewRow | undefined;
    return row ? this.mapReviewRow(row) : null;
  }

  private static upsertReview(highlightId: number, nextReviewDays: number, incrementCount: boolean): void {
    this.ensureReview(highlightId);

    db.prepare(`
      UPDATE highlight_reviews
      SET
        last_reviewed_at = CURRENT_TIMESTAMP,
        next_review_at = datetime('now', ?),
        review_count = review_count + ?
      WHERE highlight_id = ?
    `).run(`+${nextReviewDays} days`, incrementCount ? 1 : 0, highlightId);
  }

  private static ensureReview(highlightId: number): void {
    db.prepare(`
      INSERT OR IGNORE INTO highlight_reviews (highlight_id)
      VALUES (?)
    `).run(highlightId);
  }

  private static ensureDailyQueue(limit: number): void {
    const existing = db.prepare(`
      SELECT COUNT(*) as count
      FROM daily_review_queue
      WHERE review_date = date('now')
    `).get() as { count: number };

    if (existing.count > 0) {
      return;
    }

    db.prepare(`
      WITH candidates AS (
        SELECT
          h.id,
          ABS(RANDOM()) as sort_order
        FROM highlights h
        LEFT JOIN highlight_reviews hr ON hr.highlight_id = h.id
        WHERE COALESCE(hr.archived, 0) = 0
          AND (
            hr.next_review_at IS NULL
            OR datetime(hr.next_review_at) <= datetime('now')
          )
        ORDER BY sort_order ASC
        LIMIT ?
      )
      INSERT OR IGNORE INTO daily_review_queue (review_date, highlight_id, sort_order)
      SELECT date('now'), id, sort_order
      FROM candidates
    `).run(limit);
  }

  private static getDailyLimit(limit: number): number {
    if (!Number.isFinite(limit) || limit <= 0) {
      return this.DAILY_REVIEW_LIMIT;
    }

    return Math.min(Math.floor(limit), this.DAILY_REVIEW_LIMIT);
  }

  private static mapReviewRow(row: ReviewRow): ReviewHighlight {
    return {
      ...row,
      bookAuthors: JSON.parse(row.bookAuthors),
      favorite: row.favorite === 1
    };
  }
}
