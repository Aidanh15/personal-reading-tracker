import request from 'supertest';
import express from 'express';
import { highlightsRouter } from '../routes/highlights';
import { errorHandler } from '../middleware/errorHandler';
import { HighlightQueries } from '../database/queries/highlights';
import { Highlight } from '../types';

// Mock the database queries
jest.mock('../database/queries/highlights');

const mockHighlightQueries = HighlightQueries as jest.Mocked<typeof HighlightQueries>;

describe('Highlights API Integration Tests', () => {
    let app: express.Application;

    beforeEach(() => {
        app = express();
        app.use(express.json());
        app.use('/api/highlights', highlightsRouter);
        app.use(errorHandler);

        // Reset all mocks
        jest.clearAllMocks();
    });

    const mockHighlight: Highlight = {
        id: 1,
        bookId: 1,
        quoteText: 'War is peace. Freedom is slavery. Ignorance is strength.',
        pageNumber: 4,
        location: 'Chapter 1',
        personalNotes: 'The Party\'s contradictory slogans',
        highlightDate: '2024-01-01T00:00:00.000Z',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z'
    };

    describe('GET /api/highlights/:id', () => {
        it('should retrieve highlight by ID successfully', async () => {
            mockHighlightQueries.getHighlightById.mockReturnValue(mockHighlight);

            const response = await request(app)
                .get('/api/highlights/1')
                .expect(200);

            expect(response.body).toHaveProperty('highlight');
            expect(response.body.highlight).toMatchObject({
                id: 1,
                bookId: 1,
                quoteText: 'War is peace. Freedom is slavery. Ignorance is strength.',
                pageNumber: 4,
                personalNotes: 'The Party\'s contradictory slogans'
            });
            expect(mockHighlightQueries.getHighlightById).toHaveBeenCalledWith(1);
        });

        it('should return 404 for non-existent highlight', async () => {
            mockHighlightQueries.getHighlightById.mockReturnValue(null);

            const response = await request(app)
                .get('/api/highlights/999')
                .expect(404);

            expect(response.body.error.code).toBe('HIGHLIGHT_NOT_FOUND');
            expect(response.body.error.message).toBe('Highlight not found');
        });

        it('should validate highlight ID parameter', async () => {
            const response = await request(app)
                .get('/api/highlights/invalid-id')
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('PUT /api/highlights/:id', () => {
        const updateData = {
            quoteText: 'Updated quote text',
            pageNumber: 10,
            personalNotes: 'Updated personal notes'
        };

        it('should update highlight successfully', async () => {
            const updatedHighlight = { ...mockHighlight, ...updateData };
            mockHighlightQueries.getHighlightById.mockReturnValue(mockHighlight);
            mockHighlightQueries.updateHighlight.mockReturnValue(updatedHighlight);

            const response = await request(app)
                .put('/api/highlights/1')
                .send(updateData)
                .expect(200);

            expect(response.body).toHaveProperty('highlight');
            expect(response.body.highlight.quoteText).toBe('Updated quote text');
            expect(response.body.highlight.pageNumber).toBe(10);
            expect(response.body.highlight.personalNotes).toBe('Updated personal notes');
            expect(mockHighlightQueries.updateHighlight).toHaveBeenCalledWith(1, updateData);
        });

        it('should return 404 for non-existent highlight', async () => {
            mockHighlightQueries.getHighlightById.mockReturnValue(null);

            const response = await request(app)
                .put('/api/highlights/999')
                .send(updateData)
                .expect(404);

            expect(response.body.error.code).toBe('HIGHLIGHT_NOT_FOUND');
        });

        it('should allow partial updates', async () => {
            const partialUpdate = { personalNotes: 'Only updating notes' };
            const updatedHighlight = { ...mockHighlight, ...partialUpdate };

            mockHighlightQueries.getHighlightById.mockReturnValue(mockHighlight);
            mockHighlightQueries.updateHighlight.mockReturnValue(updatedHighlight);

            const response = await request(app)
                .put('/api/highlights/1')
                .send(partialUpdate)
                .expect(200);

            expect(response.body.highlight.personalNotes).toBe('Only updating notes');
            expect(mockHighlightQueries.updateHighlight).toHaveBeenCalledWith(1, partialUpdate);
        });

        it('should validate quote text length when provided', async () => {
            const invalidUpdate = {
                quoteText: '' // Empty quote text should fail validation
            };

            const response = await request(app)
                .put('/api/highlights/1')
                .send(invalidUpdate)
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should validate page number when provided', async () => {
            const invalidUpdate = {
                pageNumber: -5 // Negative page number should fail validation
            };

            const response = await request(app)
                .put('/api/highlights/1')
                .send(invalidUpdate)
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });

        it('should validate highlight ID parameter', async () => {
            const response = await request(app)
                .put('/api/highlights/invalid-id')
                .send(updateData)
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('DELETE /api/highlights/:id', () => {
        it('should delete highlight successfully', async () => {
            mockHighlightQueries.deleteHighlight.mockReturnValue(true);

            const response = await request(app)
                .delete('/api/highlights/1')
                .expect(204);

            expect(response.body).toEqual({});
            expect(mockHighlightQueries.deleteHighlight).toHaveBeenCalledWith(1);
        });

        it('should return 404 for non-existent highlight', async () => {
            mockHighlightQueries.deleteHighlight.mockReturnValue(false);

            const response = await request(app)
                .delete('/api/highlights/999')
                .expect(404);

            expect(response.body.error.code).toBe('HIGHLIGHT_NOT_FOUND');
        });

        it('should validate highlight ID parameter', async () => {
            const response = await request(app)
                .delete('/api/highlights/invalid-id')
                .expect(400);

            expect(response.body.error.code).toBe('VALIDATION_ERROR');
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            mockHighlightQueries.getHighlightById.mockImplementation(() => {
                throw new Error('Database connection failed');
            });

            const response = await request(app)
                .get('/api/highlights/1')
                .expect(500);

            expect(response.body.error.message).toBe('Database connection failed');
        });

        it('should return structured error responses', async () => {
            mockHighlightQueries.getHighlightById.mockReturnValue(null);

            const response = await request(app)
                .get('/api/highlights/999')
                .expect(404);

            expect(response.body).toHaveProperty('error');
            expect(response.body.error).toHaveProperty('message');
            expect(response.body.error).toHaveProperty('code');
            expect(response.body.error).toHaveProperty('timestamp');
        });
    });
});