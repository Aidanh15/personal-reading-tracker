import request from 'supertest';
import express from 'express';
import { errorHandler } from '../middleware/errorHandler';
import { booksRouter } from '../routes/books';

// Mock the database queries
jest.mock('../database/queries/books');
jest.mock('../database/queries/highlights');

describe('API Structure Tests', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/books', booksRouter);
    app.use(errorHandler);
  });

  describe('Books API', () => {
    it('should have GET /api/books endpoint', async () => {
      const response = await request(app)
        .get('/api/books')
        .expect('Content-Type', /json/);
      
      // Should not return 404 (route exists)
      expect(response.status).not.toBe(404);
    });

    it('should validate book creation request', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({
          // Missing required fields
        })
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should validate book ID parameter', async () => {
      const response = await request(app)
        .get('/api/books/invalid-id')
        .expect(400);

      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('Error Handling', () => {
    it('should return structured error response', async () => {
      const response = await request(app)
        .post('/api/books')
        .send({})
        .expect(400);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toHaveProperty('message');
      expect(response.body.error).toHaveProperty('code');
      expect(response.body.error).toHaveProperty('timestamp');
    });
  });
});