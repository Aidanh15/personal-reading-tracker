import express, { Request, Response, NextFunction } from 'express';
import { validateQuery, schemas } from '../middleware/validation';
import { Book, Highlight } from '../types';
import { getDatabase } from '../database/connection';

const router = express.Router();

interface SearchResult {
  books: Book[];
  highlights: (Highlight & { bookTitle: string; bookAuthors: string[] })[];
  totalResults: number;
  query: string;
  filters: {
    status?: string;
    dateRange?: {
      start?: string | undefined;
      end?: string | undefined;
    };
    sortBy?: string;
    sortOrder?: string;
  };
}

// GET /api/search - Comprehensive search across books and highlights
router.get('/',
  validateQuery(schemas.searchQuery),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const {
        q: query = '',
        status,
        startDate,
        endDate,
        sortBy = 'relevance',
        sortOrder = 'desc',
        limit = '50',
        offset = '0'
      } = req.query as Record<string, string>;

      const searchLimit = Math.min(parseInt(limit), 100); // Max 100 results
      const searchOffset = Math.max(parseInt(offset), 0);

      // Search books
      const books = searchBooks({
        query,
        status: status || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sortBy,
        sortOrder,
        limit: searchLimit,
        offset: searchOffset
      });

      // Search highlights
      const highlights = searchHighlights({
        query,
        sortBy,
        sortOrder,
        limit: searchLimit,
        offset: searchOffset
      });

      const result: SearchResult = {
        books,
        highlights,
        totalResults: books.length + highlights.length,
        query,
        filters: {
          ...(status && { status }),
          dateRange: {
            ...(startDate && { start: startDate }),
            ...(endDate && { end: endDate })
          },
          sortBy,
          sortOrder
        }
      };

      res.json(result);
    } catch (error) {
      next(error);
    }
  }
);

// Helper function to search books with advanced filtering and sorting
function searchBooks(params: {
  query: string;
  status: string | undefined;
  startDate: string | undefined;
  endDate: string | undefined;
  sortBy: string;
  sortOrder: string;
  limit: number;
  offset: number;
}): Book[] {
  const { query, status, startDate, endDate, sortBy, sortOrder, limit, offset } = params;
  
  let sql = `
    SELECT * FROM books 
    WHERE 1=1
  `;
  const sqlParams: any[] = [];

  // Add text search conditions
  if (query.trim()) {
    sql += ` AND (
      title LIKE ? OR 
      authors LIKE ?
    )`;
    const searchTerm = `%${query.trim()}%`;
    sqlParams.push(searchTerm, searchTerm);
  }

  // Add status filter
  if (status && ['not_started', 'in_progress', 'completed'].includes(status)) {
    sql += ` AND status = ?`;
    sqlParams.push(status);
  }

  // Add date range filter
  if (startDate) {
    sql += ` AND created_at >= ?`;
    sqlParams.push(startDate);
  }
  if (endDate) {
    sql += ` AND created_at <= ?`;
    sqlParams.push(endDate + 'T23:59:59.999Z'); // Include full end date
  }

  // Add sorting
  switch (sortBy) {
    case 'title':
      sql += ` ORDER BY title ${sortOrder.toUpperCase()}`;
      break;
    case 'date':
    case 'dateAdded':
      sql += ` ORDER BY created_at ${sortOrder.toUpperCase()}`;
      break;
    case 'progress':
      sql += ` ORDER BY progress_percentage ${sortOrder.toUpperCase()}`;
      break;
    case 'status':
      sql += ` ORDER BY status ${sortOrder.toUpperCase()}, created_at DESC`;
      break;
    case 'position':
      sql += ` ORDER BY position ${sortOrder.toUpperCase()}`;
      break;
    case 'relevance':
    default:
      // For relevance, prioritize exact matches, then partial matches
      if (query.trim()) {
        sql += ` ORDER BY 
          CASE 
            WHEN title = ? THEN 1
            WHEN title LIKE ? THEN 2
            WHEN authors LIKE ? THEN 3
            ELSE 4
          END ${sortOrder.toUpperCase()}, created_at DESC`;
        const exactMatch = query.trim();
        const startMatch = `${query.trim()}%`;
        const containsMatch = `%${query.trim()}%`;
        sqlParams.push(exactMatch, startMatch, containsMatch);
      } else {
        sql += ` ORDER BY created_at DESC`;
      }
      break;
  }

  // Add pagination
  sql += ` LIMIT ? OFFSET ?`;
  sqlParams.push(limit, offset);

  const db = getDatabase();
  const stmt = db.prepare(sql);
  const results = stmt.all(...sqlParams);
  
  // Transform results to match Book interface (same as BookQueries)
  return results.map((row: any) => ({
    id: row.id,
    title: row.title,
    authors: JSON.parse(row.authors || '[]'),
    position: row.position,
    status: row.status,
    progressPercentage: row.progress_percentage,
    totalPages: row.total_pages,
    currentPage: row.current_page,
    startedDate: row.started_date,
    completedDate: row.completed_date,
    personalRating: row.personal_rating,
    personalReview: row.personal_review,
    coverImageUrl: row.cover_image_url,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  })) as Book[];
}

// Helper function to search highlights with advanced filtering and sorting
function searchHighlights(params: {
  query: string;
  sortBy: string;
  sortOrder: string;
  limit: number;
  offset: number;
}): (Highlight & { bookTitle: string; bookAuthors: string[] })[] {
  const { query, sortBy, sortOrder, limit, offset } = params;
  
  let sql = `
    SELECT h.*, b.title as bookTitle, b.authors as bookAuthors
    FROM highlights h
    JOIN books b ON h.book_id = b.id
    WHERE 1=1
  `;
  const sqlParams: any[] = [];

  // Add text search conditions
  if (query.trim()) {
    sql += ` AND (
      h.quote_text LIKE ? OR 
      h.personal_notes LIKE ? OR
      h.location LIKE ?
    )`;
    const searchTerm = `%${query.trim()}%`;
    sqlParams.push(searchTerm, searchTerm, searchTerm);
  }

  // Add sorting
  switch (sortBy) {
    case 'date':
    case 'dateAdded':
      sql += ` ORDER BY h.created_at ${sortOrder.toUpperCase()}`;
      break;
    case 'book':
      sql += ` ORDER BY b.title ${sortOrder.toUpperCase()}, h.page_number ASC`;
      break;
    case 'page':
      sql += ` ORDER BY h.page_number ${sortOrder.toUpperCase()}, h.created_at DESC`;
      break;
    case 'relevance':
    default:
      // For relevance, prioritize quote matches over note matches
      if (query.trim()) {
        sql += ` ORDER BY 
          CASE 
            WHEN h.quote_text LIKE ? THEN 1
            WHEN h.personal_notes LIKE ? THEN 2
            WHEN h.location LIKE ? THEN 3
            ELSE 4
          END ${sortOrder.toUpperCase()}, h.created_at DESC`;
        const searchTerm = `%${query.trim()}%`;
        sqlParams.push(searchTerm, searchTerm, searchTerm);
      } else {
        sql += ` ORDER BY h.created_at DESC`;
      }
      break;
  }

  // Add pagination
  sql += ` LIMIT ? OFFSET ?`;
  sqlParams.push(limit, offset);

  const db = getDatabase();
  const stmt = db.prepare(sql);
  const results = stmt.all(...sqlParams);
  
  // Transform results to include book info but maintain Highlight structure
  return results.map((row: any) => ({
    id: row.id,
    bookId: row.book_id,
    quoteText: row.quote_text,
    pageNumber: row.page_number,
    location: row.location,
    personalNotes: row.personal_notes,
    highlightDate: row.highlight_date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Additional context for search results
    bookTitle: row.bookTitle,
    bookAuthors: JSON.parse(row.bookAuthors || '[]')
  })) as (Highlight & { bookTitle: string; bookAuthors: string[] })[];
}

export { router as searchRouter };