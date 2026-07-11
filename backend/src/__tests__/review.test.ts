import request from 'supertest';
import express from 'express';
import { reviewRouter } from '../routes/review';
import { errorHandler } from '../middleware/errorHandler';
import { ReviewQueries } from '../database/queries/review';
import { ReviewHighlight, ReviewSummary } from '../types';

jest.mock('../database/queries/review');

const mockReviewQueries = ReviewQueries as jest.Mocked<typeof ReviewQueries>;

describe('Review API', () => {
  let app: express.Application;

  const savedHighlight: ReviewHighlight = {
    id: 7,
    bookId: 2,
    quoteText: 'A passage worth returning to.',
    bookTitle: 'The Test Book',
    bookAuthors: ['Test Author'],
    highlightDate: '2024-01-01T00:00:00.000Z',
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    reviewCount: 1,
    favorite: true
  };

  const summary: ReviewSummary = {
    totalHighlights: 1,
    dueCount: 0,
    reviewedToday: 1,
    favoriteCount: 1,
    archivedCount: 0
  };

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/review', reviewRouter);
    app.use(errorHandler);
    jest.clearAllMocks();
  });

  it('returns saved highlights for further viewing', async () => {
    mockReviewQueries.getSavedHighlights.mockReturnValue([savedHighlight]);

    const response = await request(app).get('/api/review/saved').expect(200);

    expect(response.body.highlights).toEqual([savedHighlight]);
    expect(mockReviewQueries.getSavedHighlights).toHaveBeenCalledTimes(1);
  });

  it('can remove a highlight from saved through the favorite toggle', async () => {
    mockReviewQueries.recordAction.mockReturnValue({ ...savedHighlight, favorite: false });
    mockReviewQueries.getSummary.mockReturnValue({ ...summary, favoriteCount: 0 });

    const response = await request(app)
      .post('/api/review/7')
      .send({ action: 'favorite' })
      .expect(200);

    expect(response.body.highlight.favorite).toBe(false);
    expect(response.body.summary.favoriteCount).toBe(0);
  });
});
