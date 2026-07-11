import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { ReviewQueries } from '../database/queries/review';
import { validateBody, validateParams, validateQuery } from '../middleware/validation';
import { createError } from '../middleware/errorHandler';

const router = Router();

const reviewQuerySchema = z.object({
  limit: z.string()
    .regex(/^\d+$/, 'Limit must be a number')
    .transform(Number)
    .refine(n => n > 0 && n <= 50, 'Limit must be between 1 and 50')
    .default('12')
});

const highlightIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Highlight ID must be a number').transform(Number)
});

const reviewActionSchema = z.object({
  action: z.enum(['read', 'later', 'favorite', 'archive'])
});

// GET /api/review/summary - Get daily review counts
router.get('/summary', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ summary: ReviewQueries.getSummary() });
  } catch (error) {
    next(error);
  }
});

// GET /api/review/due - Get due highlights for today's review queue
router.get('/due',
  validateQuery(reviewQuerySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const limit = req.query['limit'] as unknown as number;
      res.json({ highlights: ReviewQueries.getDueHighlights(limit) });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/review/saved - View all highlights explicitly saved during review
router.get('/saved', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ highlights: ReviewQueries.getSavedHighlights() });
  } catch (error) {
    next(error);
  }
});

// POST /api/review/:id - Record a review action for a highlight
router.post('/:id',
  validateParams(highlightIdSchema),
  validateBody(reviewActionSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const highlightId = req.params['id'] as unknown as number;
      const highlight = ReviewQueries.recordAction(highlightId, req.body.action);

      if (!highlight) {
        throw createError('Highlight not found', 404, 'HIGHLIGHT_NOT_FOUND');
      }

      res.json({ highlight, summary: ReviewQueries.getSummary() });
    } catch (error) {
      next(error);
    }
  }
);

export { router as reviewRouter };
