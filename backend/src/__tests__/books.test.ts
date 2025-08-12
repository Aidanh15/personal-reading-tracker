import request from 'supertest';
import express from 'express';
import { booksRouter } from '../routes/books';
import { errorHandler } from '../middleware/errorHandler';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { Book } from '../types';

// Mock the database queries
jest.mock('../database/queries/books');
jest.mock('../database/queries/highlights');

const mockBookQueries = BookQueries as jest.Mocked<typeof BookQueries>;
const mockHighlightQueries = HighlightQueries as jest.Mocked<typeof HighlightQueries>;

describe('Books API Integration Tests', () => {
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
    status: 'not_started' as const,
    progressPercentage: 0,
    currentPage: 0,
    totalPages: 328,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z'
  };

  const mockBooks: Book[] = [
    mockBook,
    {
      id: 2,
      title: 'The Myth of Sisyphus',
      authors: ['Albert Camus'],
      position: 2,
      status: 'in_progress' as const,
      progressPercentage: 45,
      currentPage: 95,
      totalPages: 212,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    }
  ];

  describe('GET /api/books', () => {
    it('should retrieve all books with progress data', async () => {
      mockBookQueries.getAllBooks.mockReturnValue(mockBooks);

      const response = await request(app)
        .get('/api/books')
        .expect(200);

      expect(response.body).toHaveProperty('books');
      expect(response.body.books).toHaveLength(2);
      expect(response.body.books[0]).toMatchObject({
        id: 1,
        title: '1984',
        authors: ['George Orwell'],
        status: 'not_started',
        progressPercentage: 0
      });
      expect(mockBookQueries.getAllBooks).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no books exist', async () => {
      mockBookQueries.getAllBooks.mockReturnValue([]);

      const response = await request(app)
        .get('/api/books')
        .expect(200);

      expect(response.body.books).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockBookQueries.getAllBooks.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await request(app)
        .get('/api/books')
        .expect(500);

      expect(response.body.error.message).toBe('Database connection failed');
    });
  });

  describe('GET /api/books/:id', () => {
    it('should retrieve detailed book information', async () => {
      mockBookQueries.getBookById.mockReturnValue(mockBook);

      const response = await request(app)
        .get('/api/books/1')
        .expect(200);

      expect(response.body).toHaveProperty('book');
      expect(response.body.book).toMatchObject({
        id: 1,
        title: '1984',
        authors: ['George Orwell']
      });
      expect(mockBookQueries.getBookById).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent book', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .get('/api/books/999')
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
      expect(response.body.error.message).toBe('Book not found');
    });

    it('should validate book ID parameter', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('POST /api/books', () => {
    const validBookData = {
      title: 'Meditations',
      authors: ['Marcus Aurelius'],
      totalPages: 304
    };

    it('should create a new book successfully', async () => {
      const createdBook = { ...mockBook, id: 3, ...validBookData };
      mockBookQueries.createBook.mockReturnValue(createdBook);

      const response = await request(app)
        .post('/api/books')
        .send(validBookData)
        .expect(201);

      expect(response.body).toHaveProperty('book');
      expect(response.body.book.title).toBe('Meditations');
      expect(response.body.book.authors).toEqual(['Marcus Aurelius']);
      expect(mockBookQueries.createBook).toHaveBeenCalledWith(validBookData);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: 'title' }),
          expect.objectContaining({ field: 'authors' })
        ])
      );
    });

    it('should validate title length', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({
          title: '',
          authors: ['Test Author']
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate authors array', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({
          title: 'Test Book',
          authors: []
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle optional fields correctly', async () => {
      const bookWithOptionals = {
        ...validBookData,
        position: 5,
        coverImageUrl: 'https://example.com/cover.jpg'
      };
      const createdBook = { ...mockBook, ...bookWithOptionals };
      mockBookQueries.createBook.mockReturnValue(createdBook);

      const response = await request(app)
        .post('/api/books')
        .send(bookWithOptionals)
        .expect(201);

      expect(response.body.book.position).toBe(5);
      expect(response.body.book.coverImageUrl).toBe('https://example.com/cover.jpg');
    });
  });

  describe('PUT /api/books/:id/progress', () => {
    const progressUpdate = {
      currentPage: 150,
      progressPercentage: 45,
      totalPages: 328
    };

    it('should update book progress successfully', async () => {
      const updatedBook = { ...mockBook, ...progressUpdate };
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockBookQueries.updateBookProgress.mockReturnValue(updatedBook);

      const response = await request(app)
        .put('/api/books/1/progress')
        .send(progressUpdate)
        .expect(200);

      expect(response.body.book.currentPage).toBe(150);
      expect(response.body.book.progressPercentage).toBe(45);
      expect(mockBookQueries.updateBookProgress).toHaveBeenCalledWith(1, progressUpdate);
    });

    it('should return 404 for non-existent book', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .put('/api/books/999/progress')
        .send(progressUpdate)
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
    });

    it('should validate progress percentage range', async () => {
      const response = await request(app)
        .put('/api/books/1/progress')
        .send({ progressPercentage: 150 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow partial updates', async () => {
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockBookQueries.updateBookProgress.mockReturnValue(mockBook);

      await request(app)
        .put('/api/books/1/progress')
        .send({ currentPage: 100 })
        .expect(200);

      expect(mockBookQueries.updateBookProgress).toHaveBeenCalledWith(1, { currentPage: 100 });
    });
  });

  describe('PUT /api/books/:id/status', () => {
    const statusUpdate = {
      status: 'in_progress' as const,
      startedDate: '2024-01-15T10:00:00.000Z'
    };

    it('should update book status successfully', async () => {
      const updatedBook = { ...mockBook, ...statusUpdate };
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockBookQueries.updateBookStatus.mockReturnValue(updatedBook);

      const response = await request(app)
        .put('/api/books/1/status')
        .send(statusUpdate)
        .expect(200);

      expect(response.body.book.status).toBe('in_progress');
      expect(response.body.book.startedDate).toBe('2024-01-15T10:00:00.000Z');
      expect(mockBookQueries.updateBookStatus).toHaveBeenCalledWith(1, statusUpdate);
    });

    it('should validate status enum values', async () => {
      const response = await request(app)
        .put('/api/books/1/status')
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should handle completion status with date', async () => {
      const completionUpdate = {
        status: 'completed' as const,
        completedDate: '2024-01-20T15:30:00.000Z'
      };
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockBookQueries.updateBookStatus.mockReturnValue({ ...mockBook, ...completionUpdate });

      const response = await request(app)
        .put('/api/books/1/status')
        .send(completionUpdate)
        .expect(200);

      expect(response.body.book.status).toBe('completed');
      expect(response.body.book.completedDate).toBe('2024-01-20T15:30:00.000Z');
    });
  });

  describe('PUT /api/books/reorder', () => {
    it('should reorder books successfully', async () => {
      const bookIds = [2, 1, 3];
      mockBookQueries.getBookById
        .mockReturnValueOnce(mockBooks[1]!)
        .mockReturnValueOnce(mockBooks[0]!)
        .mockReturnValueOnce({ ...mockBook, id: 3 });
      mockBookQueries.reorderBooks.mockImplementation(() => {});
      mockBookQueries.getAllBooks.mockReturnValue(mockBooks);

      const response = await request(app)
        .put('/api/books/reorder')
        .send({ bookIds })
        .expect(200);

      expect(response.body).toHaveProperty('books');
      expect(mockBookQueries.reorderBooks).toHaveBeenCalledWith(bookIds);
      expect(mockBookQueries.getAllBooks).toHaveBeenCalled();
    });

    it('should validate that all book IDs exist', async () => {
      mockBookQueries.getBookById
        .mockReturnValueOnce(mockBook)
        .mockReturnValueOnce(null);

      const response = await request(app)
        .put('/api/books/reorder')
        .send({ bookIds: [1, 999] })
        .expect(404);

      expect(response.body.error.message).toContain('Book with ID 999 not found');
    });

    it('should validate bookIds array', async () => {
      const response = await request(app)
        .put('/api/books/reorder')
        .send({ bookIds: [] })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('DELETE /api/books/:id', () => {
    it('should delete book successfully', async () => {
      mockBookQueries.deleteBook.mockReturnValue(true);

      const response = await request(app)
        .delete('/api/books/1')
        .expect(204);

      expect(response.body).toEqual({});
      expect(mockBookQueries.deleteBook).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent book', async () => {
      mockBookQueries.deleteBook.mockReturnValue(false);

      const response = await request(app)
        .delete('/api/books/999')
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
    });
  });

  describe('GET /api/books/:id/highlights', () => {
    const mockHighlights = [
      {
        id: 1,
        bookId: 1,
        quoteText: 'War is peace. Freedom is slavery. Ignorance is strength.',
        pageNumber: 4,
        personalNotes: 'The Party\'s contradictory slogans',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
      }
    ];

    it('should retrieve highlights for a book', async () => {
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockHighlightQueries.getHighlightsByBookId.mockReturnValue(mockHighlights);

      const response = await request(app)
        .get('/api/books/1/highlights')
        .expect(200);

      expect(response.body).toHaveProperty('highlights');
      expect(response.body.highlights).toHaveLength(1);
      expect(response.body.highlights[0].quoteText).toBe('War is peace. Freedom is slavery. Ignorance is strength.');
      expect(mockHighlightQueries.getHighlightsByBookId).toHaveBeenCalledWith(1);
    });

    it('should return 404 for non-existent book', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .get('/api/books/999/highlights')
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
    });
  });

  describe('POST /api/books/:id/highlights', () => {
    const validHighlight = {
      quoteText: 'Big Brother is watching you.',
      pageNumber: 2,
      personalNotes: 'Omnipresent surveillance state'
    };

    it('should add highlight to book successfully', async () => {
      const createdHighlight = { id: 2, bookId: 1, ...validHighlight, createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' };
      mockBookQueries.getBookById.mockReturnValue(mockBook);
      mockHighlightQueries.createHighlight.mockReturnValue(createdHighlight);

      const response = await request(app)
        .post('/api/books/1/highlights')
        .send(validHighlight)
        .expect(201);

      expect(response.body).toHaveProperty('highlight');
      expect(response.body.highlight.quoteText).toBe('Big Brother is watching you.');
      expect(mockHighlightQueries.createHighlight).toHaveBeenCalledWith(1, validHighlight);
    });

    it('should return 404 for non-existent book', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .post('/api/books/999/highlights')
        .send(validHighlight)
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
    });

    it('should validate required quote text', async () => {
      const response = await request(app)
        .post('/api/books/1/highlights')
        .send({})
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});