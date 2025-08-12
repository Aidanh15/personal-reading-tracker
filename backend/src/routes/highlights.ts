import { Router, Request, Response, NextFunction } from 'express';
import { HighlightQueries } from '../database/queries/highlights';
import { validateBody, validateParams, schemas } from '../middleware/validation';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

// Parameter validation schema
const highlightIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Highlight ID must be a number').transform(Number)
});

// GET /api/highlights/:id - Get highlight by ID
router.get('/:id',
  validateParams(highlightIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const highlightId = req.params['id'] as unknown as number;
      const highlight = HighlightQueries.getHighlightById(highlightId);
      
      if (!highlight) {
        throw createError('Highlight not found', 404, 'HIGHLIGHT_NOT_FOUND');
      }

      res.json({ highlight });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/highlights/:id - Update highlight
router.put('/:id',
  validateParams(highlightIdSchema),
  validateBody(schemas.updateHighlight),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const highlightId = req.params['id'] as unknown as number;
      
      // Check if highlight exists
      const existingHighlight = HighlightQueries.getHighlightById(highlightId);
      if (!existingHighlight) {
        throw createError('Highlight not found', 404, 'HIGHLIGHT_NOT_FOUND');
      }

      const highlight = HighlightQueries.updateHighlight(highlightId, req.body);
      res.json({ highlight });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/highlights/:id - Delete highlight
router.delete('/:id',
  validateParams(highlightIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const highlightId = req.params['id'] as unknown as number;
      
      const deleted = HighlightQueries.deleteHighlight(highlightId);
      if (!deleted) {
        throw createError('Highlight not found', 404, 'HIGHLIGHT_NOT_FOUND');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export { router as highlightsRouter };