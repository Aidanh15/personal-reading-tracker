import express, { Request, Response, NextFunction } from 'express';
import { validateQuery, schemas } from '../middleware/validation';
import { Book, Highlight } from '../types';
import { db } from '../database/connection';

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
    sql += ` AND createdAt >= ?`;
    sqlParams.push(startDate);
  }
  if (endDate) {
    sql += ` AND createdAt <= ?`;
    sqlParams.push(endDate + 'T23:59:59.999Z'); // Include full end date
  }

  // Add sorting
  switch (sortBy) {
    case 'title':
      sql += ` ORDER BY title ${sortOrder.toUpperCase()}`;
      break;
    case 'date':
    case 'dateAdded':
      sql += ` ORDER BY createdAt ${sortOrder.toUpperCase()}`;
      break;
    case 'progress':
      sql += ` ORDER BY progressPercentage ${sortOrder.toUpperCase()}`;
      break;
    case 'status':
      sql += ` ORDER BY status ${sortOrder.toUpperCase()}, createdAt DESC`;
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
          END ${sortOrder.toUpperCase()}, createdAt DESC`;
        const exactMatch = query.trim();
        const startMatch = `${query.trim()}%`;
        const containsMatch = `%${query.trim()}%`;
        sqlParams.push(exactMatch, startMatch, containsMatch);
      } else {
        sql += ` ORDER BY createdAt DESC`;
      }
      break;
  }

  // Add pagination
  sql += ` LIMIT ? OFFSET ?`;
  sqlParams.push(limit, offset);

  const stmt = db.prepare(sql);
  return stmt.all(...sqlParams) as Book[];
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
    JOIN books b ON h.bookId = b.id
    WHERE 1=1
  `;
  const sqlParams: any[] = [];

  // Add text search conditions
  if (query.trim()) {
    sql += ` AND (
      h.quoteText LIKE ? OR 
      h.personalNotes LIKE ? OR
      h.location LIKE ?
    )`;
    const searchTerm = `%${query.trim()}%`;
    sqlParams.push(searchTerm, searchTerm, searchTerm);
  }

  // Add sorting
  switch (sortBy) {
    case 'date':
    case 'dateAdded':
      sql += ` ORDER BY h.createdAt ${sortOrder.toUpperCase()}`;
      break;
    case 'book':
      sql += ` ORDER BY b.title ${sortOrder.toUpperCase()}, h.pageNumber ASC`;
      break;
    case 'page':
      sql += ` ORDER BY h.pageNumber ${sortOrder.toUpperCase()}, h.createdAt DESC`;
      break;
    case 'relevance':
    default:
      // For relevance, prioritize quote matches over note matches
      if (query.trim()) {
        sql += ` ORDER BY 
          CASE 
            WHEN h.quoteText LIKE ? THEN 1
            WHEN h.personalNotes LIKE ? THEN 2
            WHEN h.location LIKE ? THEN 3
            ELSE 4
          END ${sortOrder.toUpperCase()}, h.createdAt DESC`;
        const searchTerm = `%${query.trim()}%`;
        sqlParams.push(searchTerm, searchTerm, searchTerm);
      } else {
        sql += ` ORDER BY h.createdAt DESC`;
      }
      break;
  }

  // Add pagination
  sql += ` LIMIT ? OFFSET ?`;
  sqlParams.push(limit, offset);

  const stmt = db.prepare(sql);
  const results = stmt.all(...sqlParams);
  
  // Transform results to include book info but maintain Highlight structure
  return results.map((row: any) => ({
    id: row.id,
    bookId: row.bookId,
    quoteText: row.quoteText,
    pageNumber: row.pageNumber,
    location: row.location,
    personalNotes: row.personalNotes,
    highlightDate: row.highlightDate,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    // Additional context for search results
    bookTitle: row.bookTitle,
    bookAuthors: JSON.parse(row.bookAuthors || '[]')
  })) as (Highlight & { bookTitle: string; bookAuthors: string[] })[];
}

export { router as searchRouter };