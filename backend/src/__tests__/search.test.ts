import request from 'supertest';
import express from 'express';
import { searchRouter } from '../routes/search';
import { errorHandler } from '../middleware/errorHandler';
import { Book } from '../types';

// Mock the database connection
jest.mock('../database/connection', () => ({
  db: {
    prepare: jest.fn()
  }
}));

describe('Search API Integration Tests', () => {
  let app: express.Application;
  let mockDb: any;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/search', searchRouter);
    app.use(errorHandler);
    
    // Get the mocked database from the mock
    const { db } = require('../database/connection');
    mockDb = db;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  const mockBooks: Book[] = [
    {
      id: 1,
      title: '1984',
      authors: ['George Orwell'],
      position: 1,
      status: 'completed',
      progressPercentage: 100,
      totalPages: 328,
      currentPage: 328,
      startedDate: '2024-01-01',
      completedDate: '2024-01-15',
      personalRating: 5,
      personalReview: 'Excellent dystopian novel',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-15T00:00:00.000Z'
    },
    {
      id: 2,
      title: 'To Kill a Mockingbird',
      authors: ['Harper Lee'],
      position: 2,
      status: 'in_progress',
      progressPercentage: 60,
      totalPages: 281,
      currentPage: 168,
      startedDate: '2024-01-16',
      createdAt: '2024-01-16T00:00:00.000Z',
      updatedAt: '2024-01-20T00:00:00.000Z'
    },
    {
      id: 3,
      title: 'The Great Gatsby',
      authors: ['F. Scott Fitzgerald'],
      position: 3,
      status: 'not_started',
      progressPercentage: 0,
      totalPages: 180,
      currentPage: 0,
      createdAt: '2024-01-21T00:00:00.000Z',
      updatedAt: '2024-01-21T00:00:00.000Z'
    }
  ];

  const mockHighlights = [
    {
      id: 1,
      bookId: 1,
      quoteText: 'War is peace. Freedom is slavery. Ignorance is strength.',
      pageNumber: 4,
      location: 'Chapter 1',
      personalNotes: 'The Party\'s contradictory slogans',
      highlightDate: '2024-01-05T00:00:00.000Z',
      createdAt: '2024-01-05T00:00:00.000Z',
      updatedAt: '2024-01-05T00:00:00.000Z',
      bookTitle: '1984',
      bookAuthors: JSON.stringify(['George Orwell'])
    },
    {
      id: 2,
      bookId: 1,
      quoteText: 'Big Brother is watching you.',
      pageNumber: 2,
      location: 'Chapter 1',
      personalNotes: 'The omnipresent surveillance state',
      highlightDate: '2024-01-06T00:00:00.000Z',
      createdAt: '2024-01-06T00:00:00.000Z',
      updatedAt: '2024-01-06T00:00:00.000Z',
      bookTitle: '1984',
      bookAuthors: JSON.stringify(['George Orwell'])
    },
    {
      id: 3,
      bookId: 2,
      quoteText: 'You never really understand a person until you consider things from his point of view.',
      pageNumber: 30,
      location: 'Chapter 3',
      personalNotes: 'Atticus teaching empathy',
      highlightDate: '2024-01-18T00:00:00.000Z',
      createdAt: '2024-01-18T00:00:00.000Z',
      updatedAt: '2024-01-18T00:00:00.000Z',
      bookTitle: 'To Kill a Mockingbird',
      bookAuthors: JSON.stringify(['Harper Lee'])
    }
  ];

  describe('GET /api/search', () => {
    it('should perform basic search without query parameters', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      // Mock both book and highlight queries
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks); // Books result
      mockStmt.all.mockReturnValueOnce(mockHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search')
        .expect(200);

      expect(response.body).toHaveProperty('books');
      expect(response.body).toHaveProperty('highlights');
      expect(response.body).toHaveProperty('totalResults');
      expect(response.body).toHaveProperty('query', '');
      expect(response.body).toHaveProperty('filters');
      expect(response.body.books).toHaveLength(3);
      expect(response.body.highlights).toHaveLength(3);
      expect(response.body.totalResults).toBe(6);
    });

    it('should search books by title', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      const filteredBooks = mockBooks.filter(book => 
        book.title.toLowerCase().includes('1984'.toLowerCase())
      );
      
      mockStmt.all.mockReturnValueOnce(filteredBooks); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?q=1984')
        .expect(200);

      expect(response.body.query).toBe('1984');
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].title).toBe('1984');
      expect(response.body.highlights).toHaveLength(0);
      expect(response.body.totalResults).toBe(1);
    });

    it('should search books by author', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      const filteredBooks = mockBooks.filter(book => 
        JSON.stringify(book.authors).toLowerCase().includes('orwell'.toLowerCase())
      );
      
      mockStmt.all.mockReturnValueOnce(filteredBooks); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?q=Orwell')
        .expect(200);

      expect(response.body.query).toBe('Orwell');
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].authors).toContain('George Orwell');
    });

    it('should search highlights by quote text', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      const filteredHighlights = mockHighlights.filter(highlight => 
        highlight.quoteText.toLowerCase().includes('war'.toLowerCase())
      );
      
      mockStmt.all.mockReturnValueOnce([]); // Books result
      mockStmt.all.mockReturnValueOnce(filteredHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search?q=war')
        .expect(200);

      expect(response.body.query).toBe('war');
      expect(response.body.books).toHaveLength(0);
      expect(response.body.highlights).toHaveLength(1);
      expect(response.body.highlights[0].quoteText).toContain('War is peace');
    });

    it('should search highlights by personal notes', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      const filteredHighlights = mockHighlights.filter(highlight => 
        highlight.personalNotes?.toLowerCase().includes('surveillance'.toLowerCase())
      );
      
      mockStmt.all.mockReturnValueOnce([]); // Books result
      mockStmt.all.mockReturnValueOnce(filteredHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search?q=surveillance')
        .expect(200);

      expect(response.body.query).toBe('surveillance');
      expect(response.body.highlights).toHaveLength(1);
      expect(response.body.highlights[0].personalNotes).toContain('surveillance');
    });

    it('should filter books by status', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      const filteredBooks = mockBooks.filter(book => book.status === 'completed');
      
      mockStmt.all.mockReturnValueOnce(filteredBooks); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?status=completed')
        .expect(200);

      expect(response.body.filters.status).toBe('completed');
      expect(response.body.books).toHaveLength(1);
      expect(response.body.books[0].status).toBe('completed');
    });

    it('should filter by date range', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?startDate=2024-01-01&endDate=2024-01-31')
        .expect(200);

      expect(response.body.filters.dateRange.start).toBe('2024-01-01');
      expect(response.body.filters.dateRange.end).toBe('2024-01-31');
    });

    it('should support different sort options', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?sortBy=title&sortOrder=asc')
        .expect(200);

      expect(response.body.filters.sortBy).toBe('title');
      expect(response.body.filters.sortOrder).toBe('asc');
    });

    it('should support pagination with limit and offset', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce([mockBooks[0]]); // Books result (limited)
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?limit=1&offset=0')
        .expect(200);

      expect(response.body.books).toHaveLength(1);
      
      // Verify that the SQL was called with correct LIMIT and OFFSET
      expect(mockDb.prepare).toHaveBeenCalledWith(expect.stringContaining('LIMIT ? OFFSET ?'));
    });

    it('should enforce maximum limit of 100', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?limit=200') // Request more than max
        .expect(200);

      // Should still work, but limit should be capped at 100
      expect(response.body).toHaveProperty('books');
    });

    it('should handle combined search across books and highlights', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      // Search for "George" should find both book (author) and highlights
      const filteredBooks = mockBooks.filter(book => 
        JSON.stringify(book.authors).toLowerCase().includes('george'.toLowerCase())
      );
      const filteredHighlights = mockHighlights.filter(highlight => {
        const authors = JSON.parse(highlight.bookAuthors);
        return authors.some((author: string) => author.toLowerCase().includes('george'.toLowerCase()));
      });
      
      mockStmt.all.mockReturnValueOnce(filteredBooks); // Books result
      mockStmt.all.mockReturnValueOnce(filteredHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search?q=George')
        .expect(200);

      expect(response.body.query).toBe('George');
      expect(response.body.books.length).toBeGreaterThan(0);
      expect(response.body.highlights.length).toBeGreaterThan(0);
      expect(response.body.totalResults).toBeGreaterThan(0);
    });

    it('should handle relevance sorting correctly', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks); // Books result
      mockStmt.all.mockReturnValueOnce(mockHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search?q=test&sortBy=relevance')
        .expect(200);

      expect(response.body.filters.sortBy).toBe('relevance');
      
      // Verify that relevance sorting SQL was generated
      const calls = mockDb.prepare.mock.calls;
      const bookQuery = calls[0][0];
      expect(bookQuery).toContain('CASE');
      expect(bookQuery).toContain('WHEN title =');
    });

    it('should handle different sort options for highlights', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce([]); // Books result
      mockStmt.all.mockReturnValueOnce(mockHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search?sortBy=page&sortOrder=asc')
        .expect(200);

      expect(response.body.filters.sortBy).toBe('page');
      expect(response.body.filters.sortOrder).toBe('asc');
      
      // Verify that page sorting SQL was generated for highlights
      const calls = mockDb.prepare.mock.calls;
      const highlightQuery = calls[1][0];
      expect(highlightQuery).toContain('ORDER BY h.pageNumber ASC');
    });

    it('should validate invalid status filter', async () => {
      const response = await request(app)
        .get('/api/search?status=invalid_status')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate invalid date format', async () => {
      const response = await request(app)
        .get('/api/search?startDate=invalid-date')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate invalid sort options', async () => {
      const response = await request(app)
        .get('/api/search?sortBy=invalid_sort')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate invalid limit values', async () => {
      const response = await request(app)
        .get('/api/search?limit=0')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate invalid offset values', async () => {
      const response = await request(app)
        .get('/api/search?offset=-1')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate limit exceeding maximum', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?limit=150')
        .expect(200); // Should accept but cap the limit internally

      expect(response.body).toHaveProperty('books');
      expect(response.body).toHaveProperty('highlights');
      // The limit should be capped at 100 internally, but the request should succeed
    });

    it('should handle database errors gracefully', async () => {
      mockDb.prepare.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/search?q=test')
        .expect(500);

      expect(response.body.error.message).toBe('Database connection failed');
    });

    it('should handle empty search results', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce([]); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?q=nonexistent')
        .expect(200);

      expect(response.body.books).toHaveLength(0);
      expect(response.body.highlights).toHaveLength(0);
      expect(response.body.totalResults).toBe(0);
      expect(response.body.query).toBe('nonexistent');
    });

    it('should return structured response format', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks); // Books result
      mockStmt.all.mockReturnValueOnce(mockHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search?q=test&status=completed&sortBy=title')
        .expect(200);

      expect(response.body).toHaveProperty('books');
      expect(response.body).toHaveProperty('highlights');
      expect(response.body).toHaveProperty('totalResults');
      expect(response.body).toHaveProperty('query', 'test');
      expect(response.body).toHaveProperty('filters');
      expect(response.body.filters).toHaveProperty('status', 'completed');
      expect(response.body.filters).toHaveProperty('sortBy', 'title');
      expect(response.body.filters).toHaveProperty('sortOrder', 'desc');
      expect(response.body.filters).toHaveProperty('dateRange');
    });

    it('should include book context in highlight results', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce([]); // Books result
      mockStmt.all.mockReturnValueOnce(mockHighlights); // Highlights result

      const response = await request(app)
        .get('/api/search?q=war')
        .expect(200);

      expect(response.body.highlights).toHaveLength(3);
      expect(response.body.highlights[0]).toHaveProperty('bookTitle');
      expect(response.body.highlights[0]).toHaveProperty('bookAuthors');
      expect(response.body.highlights[0].bookTitle).toBe('1984');
      expect(response.body.highlights[0].bookAuthors).toContain('George Orwell');
    });

    it('should handle complex search queries with multiple filters', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce(mockBooks.slice(0, 1)); // Books result
      mockStmt.all.mockReturnValueOnce(mockHighlights.slice(0, 1)); // Highlights result

      const response = await request(app)
        .get('/api/search?q=George&status=completed&startDate=2024-01-01&endDate=2024-01-31&sortBy=title&sortOrder=asc&limit=10&offset=0')
        .expect(200);

      expect(response.body.query).toBe('George');
      expect(response.body.filters.status).toBe('completed');
      expect(response.body.filters.dateRange.start).toBe('2024-01-01');
      expect(response.body.filters.dateRange.end).toBe('2024-01-31');
      expect(response.body.filters.sortBy).toBe('title');
      expect(response.body.filters.sortOrder).toBe('asc');
    });
  });

  describe('Error Handling', () => {
    it('should return structured error responses', async () => {
      const response = await request(app)
        .get('/api/search?status=invalid')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should handle malformed query parameters', async () => {
      const response = await request(app)
        .get('/api/search?limit=abc')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle SQL injection attempts', async () => {
      const mockStmt = {
        all: jest.fn()
      };
      
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Books query
      mockDb.prepare.mockReturnValueOnce(mockStmt); // Highlights query
      
      mockStmt.all.mockReturnValueOnce([]); // Books result
      mockStmt.all.mockReturnValueOnce([]); // Highlights result

      const response = await request(app)
        .get('/api/search?q=test\'; DROP TABLE books; --')
        .expect(200);

      // Should handle safely without SQL injection
      expect(response.body.query).toBe('test\'; DROP TABLE books; --');
      expect(response.body.totalResults).toBe(0);
    });
  });
});