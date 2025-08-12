import request from 'supertest';
import express from 'express';
import { booksRouter } from '../routes/books';
import { errorHandler } from '../middleware/errorHandler';
import { BookQueries } from '../database/queries/books';
import { Book } from '../types';

// Mock the database queries
jest.mock('../database/queries/books');
jest.mock('../database/queries/highlights');

const mockBookQueries = BookQueries as jest.Mocked<typeof BookQueries>;

describe('Book Management API Endpoints', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/books', booksRouter);
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  const sampleBooks: Book[] = [
    {
      id: 1,
      title: '1984',
      authors: ['George Orwell'],
      position: 1,
      status: 'in_progress' as const,
      progressPercentage: 25,
      currentPage: 82,
      totalPages: 328,
      startedDate: '2024-01-10T00:00:00.000Z',
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-10T00:00:00.000Z'
    },
    {
      id: 2,
      title: 'The Myth of Sisyphus',
      authors: ['Albert Camus'],
      position: 2,
      status: 'not_started' as const,
      progressPercentage: 0,
      currentPage: 0,
      totalPages: 212,
      createdAt: '2024-01-01T00:00:00.000Z',
      updatedAt: '2024-01-01T00:00:00.000Z'
    },
    {
      id: 3,
      title: 'Meditations',
      authors: ['Marcus Aurelius'],
      position: 3,
      status: 'completed' as const,
      progressPercentage: 100,
      currentPage: 304,
      totalPages: 304,
      startedDate: '2023-12-01T00:00:00.000Z',
      completedDate: '2023-12-15T00:00:00.000Z',
      personalRating: 5,
      personalReview: 'Excellent philosophical insights',
      createdAt: '2023-12-01T00:00:00.000Z',
      updatedAt: '2023-12-15T00:00:00.000Z'
    }
  ];

  describe('GET /api/books - Retrieve all books with progress data', () => {
    it('should return books ordered by status and position', async () => {
      mockBookQueries.getAllBooks.mockReturnValue(sampleBooks);

      const response = await request(app)
        .get('/api/books')
        .expect(200);

      expect(response.body.books).toHaveLength(3);
      expect(response.body.books[0].status).toBe('in_progress');
      expect(response.body.books[1].status).toBe('not_started');
      expect(response.body.books[2].status).toBe('completed');
      expect(mockBookQueries.getAllBooks).toHaveBeenCalledTimes(1);
    });

    it('should include all book progress data', async () => {
      mockBookQueries.getAllBooks.mockReturnValue([sampleBooks[0]!]);

      const response = await request(app)
        .get('/api/books')
        .expect(200);

      const book = response.body.books[0];
      expect(book).toHaveProperty('progressPercentage', 25);
      expect(book).toHaveProperty('currentPage', 82);
      expect(book).toHaveProperty('totalPages', 328);
      expect(book).toHaveProperty('startedDate');
    });

    it('should handle empty book collection', async () => {
      mockBookQueries.getAllBooks.mockReturnValue([]);

      const response = await request(app)
        .get('/api/books')
        .expect(200);

      expect(response.body.books).toEqual([]);
    });
  });

  describe('GET /api/books/:id - Get detailed book information', () => {
    it('should return complete book details', async () => {
      mockBookQueries.getBookById.mockReturnValue(sampleBooks[2]!);

      const response = await request(app)
        .get('/api/books/3')
        .expect(200);

      const book = response.body.book;
      expect(book.title).toBe('Meditations');
      expect(book.authors).toEqual(['Marcus Aurelius']);
      expect(book.status).toBe('completed');
      expect(book.personalRating).toBe(5);
      expect(book.personalReview).toBe('Excellent philosophical insights');
      expect(book.completedDate).toBe('2023-12-15T00:00:00.000Z');
    });

    it('should validate numeric book ID', async () => {
      const response = await request(app)
        .get('/api/books/abc')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors[0].field).toBe('id');
    });

    it('should return 404 for non-existent book', async () => {
      mockBookQueries.getBookById.mockReturnValue(null);

      const response = await request(app)
        .get('/api/books/999')
        .expect(404);

      expect(response.body.error.code).toBe('BOOK_NOT_FOUND');
      expect(response.body.error.message).toBe('Book not found');
    });
  });

  describe('PUT /api/books/:id/progress - Update reading progress', () => {
    it('should update current page and progress percentage', async () => {
      const progressUpdate = {
        currentPage: 150,
        progressPercentage: 46
      };
      const updatedBook = { ...sampleBooks[0]!, ...progressUpdate };

      mockBookQueries.getBookById.mockReturnValue(sampleBooks[0]!);
      mockBookQueries.updateBookProgress.mockReturnValue(updatedBook);

      const response = await request(app)
        .put('/api/books/1/progress')
        .send(progressUpdate)
        .expect(200);

      expect(response.body.book.currentPage).toBe(150);
      expect(response.body.book.progressPercentage).toBe(46);
      expect(mockBookQueries.updateBookProgress).toHaveBeenCalledWith(1, progressUpdate);
    });

    it('should update total pages if provided', async () => {
      const progressUpdate = {
        totalPages: 350,
        currentPage: 100,
        progressPercentage: 29
      };

      mockBookQueries.getBookById.mockReturnValue(sampleBooks[0]!);
      mockBookQueries.updateBookProgress.mockReturnValue({ ...sampleBooks[0]!, ...progressUpdate });

      const response = await request(app)
        .put('/api/books/1/progress')
        .send(progressUpdate)
        .expect(200);

      expect(response.body.book.totalPages).toBe(350);
    });

    it('should validate progress percentage is between 0-100', async () => {
      const response = await request(app)
        .put('/api/books/1/progress')
        .send({ progressPercentage: 150 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate current page is non-negative', async () => {
      const response = await request(app)
        .put('/api/books/1/progress')
        .send({ currentPage: -5 })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should allow partial progress updates', async () => {
      mockBookQueries.getBookById.mockReturnValue(sampleBooks[0]!);
      mockBookQueries.updateBookProgress.mockReturnValue(sampleBooks[0]!);

      await request(app)
        .put('/api/books/1/progress')
        .send({ progressPercentage: 50 })
        .expect(200);

      expect(mockBookQueries.updateBookProgress).toHaveBeenCalledWith(1, { progressPercentage: 50 });
    });
  });

  describe('POST /api/books - Add new books (for customization)', () => {
    it('should create a new book with required fields', async () => {
      const newBookData = {
        title: 'Crime and Punishment',
        authors: ['Fyodor Dostoyevsky'],
        totalPages: 671
      };
      const createdBook = {
        id: 4,
        ...newBookData,
        position: 4,
        status: 'not_started' as const,
        progressPercentage: 0,
        currentPage: 0,
        createdAt: '2024-01-15T00:00:00.000Z',
        updatedAt: '2024-01-15T00:00:00.000Z'
      };

      mockBookQueries.createBook.mockReturnValue(createdBook);

      const response = await request(app)
        .post('/api/books')
        .send(newBookData)
        .expect(201);

      expect(response.body.book.title).toBe('Crime and Punishment');
      expect(response.body.book.authors).toEqual(['Fyodor Dostoyevsky']);
      expect(response.body.book.status).toBe('not_started');
      expect(mockBookQueries.createBook).toHaveBeenCalledWith(newBookData);
    });

    it('should create book with optional position and cover image', async () => {
      const newBookData = {
        title: 'The Brothers Karamazov',
        authors: ['Fyodor Dostoyevsky'],
        totalPages: 824,
        position: 1,
        coverImageUrl: 'https://example.com/cover.jpg'
      };
      const createdBook = { id: 5, ...newBookData, status: 'not_started' as const, progressPercentage: 0, currentPage: 0, createdAt: '2024-01-15T00:00:00.000Z', updatedAt: '2024-01-15T00:00:00.000Z' };

      mockBookQueries.createBook.mockReturnValue(createdBook);

      const response = await request(app)
        .post('/api/books')
        .send(newBookData)
        .expect(201);

      expect(response.body.book.position).toBe(1);
      expect(response.body.book.coverImageUrl).toBe('https://example.com/cover.jpg');
    });

    it('should validate required title field', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({ authors: ['Test Author'] })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toContainEqual(
        expect.objectContaining({ field: 'title' })
      );
    });

    it('should validate required authors field', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({ title: 'Test Book' })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
      expect(response.body.error.details.errors).toContainEqual(
        expect.objectContaining({ field: 'authors' })
      );
    });

    it('should validate authors array is not empty', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({ title: 'Test Book', authors: [] })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate cover image URL format', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({
          title: 'Test Book',
          authors: ['Test Author'],
          coverImageUrl: 'not-a-valid-url'
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle database connection errors', async () => {
      mockBookQueries.getAllBooks.mockImplementation(() => {
        throw new Error('Database connection lost');
      });

      const response = await request(app)
        .get('/api/books')
        .expect(500);

      expect(response.body.error.message).toBe('Database connection lost');
      expect(response.body.error.code).toBe('INTERNAL_SERVER_ERROR');
      expect(response.body.error).toHaveProperty('timestamp');
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/books')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      // Express handles malformed JSON automatically
      expect(response.status).toBe(400);
    });

    it('should return structured error responses', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id')
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('timestamp');
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });
});