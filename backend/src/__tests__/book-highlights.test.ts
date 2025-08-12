import request from 'supertest';
import express from 'express';
import { booksRouter } from '../routes/books';
import { errorHandler } from '../middleware/errorHandler';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { Book, Highlight } from '../types';

// Mock the database queries
jest.mock('../database/queries/books');
jest.mock('../database/queries/highlights');

const mockBookQueries = BookQueries as jest.Mocked<typeof BookQueries>;
const mockHighlightQueries = HighlightQueries as jest.Mocked<typeof HighlightQueries>;

describe('Book Highlights API Integration Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/books', booksRouter);
    app.use(errorHandler);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  const mockBook: Book = {
    id: 1,
    title: '1984',
    authors: ['George Orwell'],
    position: 1,
    status: 'in_progress',
    progressPercentage: 30.5,
    totalPages: 328,
    currentPage: 100,
    startedDate: '2024-01-01',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  const mockHighlights: Highlight[] = [
    {
      id: 1,
      bookId: 1,
      quoteText: 'War is peace. Freedom is slavery. Ignorance is strength.',
      pageNumber: 4,
      location: 'Chapter 1',
      personalNotes: 'The Party\'s contradictory slogans',
      highlightDate: '2024-01-01T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 2,
      bookId: 1,
      quoteText: 'Big Brother is watching you.',
      pageNumber: 2,
      location: 'Chapter 1',
      personalNotes: 'The omnipresent surveillance state',
      highlightDate: '2024-01-02T00:00:00.000Z',
      createdAt: '2024-01-02T00:00:00.000Z',
      updatedAt: '2024-01-02T00:00:00.000Z'
    }
  ];

  describe('GET /api/books/:id/highlights', () => {
    it('should retrieve all highlights for a book successfully', async () => {
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockHighlightQueries.getHighlightsByBookId.mockReturnValue(mockHighlights);

      const response = await request(app)
        .get('/api/books/1/highlights')
        .expect(200);

      expect(response.body).toHaveProperty('highlights');
      expect(response.body.highlights).toHaveLength(2);
      expect(response.body.highlights[0]).toMatchObject({
        id: 1,
        bookId: 1,
        quoteText: 'War is peace. Freedom is slavery. Ignorance is strength.',
        pageNumber: 4,
        personalNotes: 'The Party\'s contradictory slogans'
      });
      expect(response.body.highlights[1]).toMatchObject({
        id: 2,
        bookId: 1,
        quoteText: 'Big Brother is watching you.',
        pageNumber: 2,
        personalNotes: 'The omnipresent surveillance state'
      });
      expect(mockBookQueries.getBookById).toHaveBeenCalledWith(1);
      expect(mockHighlightQueries.getHighlightsByBookId).toHaveBeenCalledWith(1);
    });

    it('should return empty array when book has no highlights', async () => {
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockHighlightQueries.getHighlightsByBookId.mockReturnValue([]);

      const response = await request(app)
        .get('/api/books/1/highlights')
        .expect(200);

      expect(response.body).toHaveProperty('highlights');
      expect(response.body.highlights).toHaveLength(0);
      expect(response.body.highlights).toEqual([]);
    });

    it('should return 404 when book does not exist', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .get('/api/books/999/highlights')
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
      expect(response.body.error.message).toBe('Book not found');
      expect(mockHighlightQueries.getHighlightsByBookId).not.toHaveBeenCalled();
    });

    it('should validate book ID parameter', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id/highlights')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockBookQueries.getBookById).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockBookQueries.getBookById.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/books/1/highlights')
        .expect(500);

      expect(response.body.error.message).toBe('Database connection failed');
    });
  });

  describe('POST /api/books/:id/highlights', () => {
    const newHighlightData = {
      quoteText: 'The best books... are those that tell you what you know already.',
      personalNotes: 'Winston\'s reflection on meaningful literature',
      pageNumber: 156,
      location: 'Chapter 9'
    };

    const createdHighlight: Highlight = {
      id: 3,
      bookId: 1,
      quoteText: newHighlightData.quoteText,
      pageNumber: newHighlightData.pageNumber,
      location: newHighlightData.location,
      personalNotes: newHighlightData.personalNotes,
      highlightDate: '2024-01-03T00:00:00.000Z',
      createdAt: '2024-01-03T00:00:00.000Z',
      updatedAt: '2024-01-03T00:00:00.000Z'
    };

    it('should create a new highlight successfully', async () => {
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockHighlightQueries.createHighlight.mockReturnValue(createdHighlight);

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(newHighlightData)
        .expect(201);

      expect(response.body).toHaveProperty('highlight');
      expect(response.body.highlight).toMatchObject({
        id: 3,
        bookId: 1,
        quoteText: newHighlightData.quoteText,
        pageNumber: newHighlightData.pageNumber,
        personalNotes: newHighlightData.personalNotes
      });
      expect(mockBookQueries.getBookById).toHaveBeenCalledWith(1);
      expect(mockHighlightQueries.createHighlight).toHaveBeenCalledWith(1, newHighlightData);
    });

    it('should create highlight with minimal required data', async () => {
      const minimalData = {
        quoteText: 'Freedom is the freedom to say that two plus two make four.'
      };
      
      const minimalHighlight: Highlight = {
        id: 4,
        bookId: 1,
        quoteText: minimalData.quoteText,
        highlightDate: '2024-01-04T00:00:00.000Z',
        createdAt: '2024-01-04T00:00:00.000Z',
        updatedAt: '2024-01-04T00:00:00.000Z'
      };

      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockHighlightQueries.createHighlight.mockReturnValue(minimalHighlight);

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(minimalData)
        .expect(201);

      expect(response.body.highlight.quoteText).toBe(minimalData.quoteText);
      expect(mockHighlightQueries.createHighlight).toHaveBeenCalledWith(1, minimalData);
    });

    it('should return 404 when book does not exist', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .post('/api/books/999/highlights')
        .send(newHighlightData)
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
      expect(response.body.error.message).toBe('Book not found');
      expect(mockHighlightQueries.createHighlight).not.toHaveBeenCalled();
    });

    it('should validate required quoteText field', async () => {
      const invalidData = {
        personalNotes: 'Note without quote',
        pageNumber: 100
      };

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockHighlightQueries.createHighlight).not.toHaveBeenCalled();
    });

    it('should validate quote text length', async () => {
      const invalidData = {
        quoteText: '', // Empty quote should fail
        personalNotes: 'Valid note'
      };

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate quote text maximum length', async () => {
      const invalidData = {
        quoteText: 'x'.repeat(10001), // Exceeds 10000 character limit
        personalNotes: 'Valid note'
      };

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate personalNotes maximum length', async () => {
      const invalidData = {
        quoteText: 'Valid quote text',
        personalNotes: 'x'.repeat(5001) // Exceeds 5000 character limit
      };

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate page number minimum value', async () => {
      const invalidData = {
        quoteText: 'Valid quote text',
        pageNumber: 0 // Should be at least 1
      };

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate location maximum length', async () => {
      const invalidData = {
        quoteText: 'Valid quote text',
        location: 'x'.repeat(201) // Exceeds 200 character limit
      };

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(invalidData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate book ID parameter', async () => {
      const response = await request(app)
        .post('/api/books/invalid-id/highlights')
        .send(newHighlightData)
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(mockBookQueries.getBookById).not.toHaveBeenCalled();
    });

    it('should handle database errors gracefully', async () => {
      mockBookQueries.getBookById.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(newHighlightData)
        .expect(500);

      expect(response.body.error.message).toBe('Database connection failed');
    });
  });

  describe('Error Handling', () => {
    it('should return structured error responses', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .get('/api/books/999/highlights')
        .expect(404);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should handle validation errors with detailed messages', async () => {
      const response = await request(app)
        .post('/api/books/1/highlights')
        .send({}) // Empty body should trigger validation error
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error).toHaveProperty('details');
    });
  });
});