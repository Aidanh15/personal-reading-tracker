import { Router, Request, Response, NextFunction } from 'express';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { validateBody, validateParams, schemas } from '../middleware/validation';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

// Parameter validation schema
const bookIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Book ID must be a number').transform(Number)
});

// GET /api/books - Get all books
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const books = BookQueries.getAllBooks();
    res.json({ books });
  } catch (error) {
    next(error);
  }
});

// GET /api/books/:id - Get book by ID
router.get('/:id', 
  validateParams(bookIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;
      const book = BookQueries.getBookById(bookId);
      
      if (!book) {
        throw createError('Book not found', 404, 'BOOK_NOT_FOUND');
      }

      res.json({ book });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/books - Create new book
router.post('/',
  validateBody(schemas.createBook),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const book = BookQueries.createBook(req.body);
      res.status(201).json({ book });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/books/:id/progress - Update book progress
router.put('/:id/progress',
  validateParams(bookIdSchema),
  validateBody(schemas.updateBookProgress),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;
      
      // Check if book exists
      const existingBook = BookQueries.getBookById(bookId);
      if (!existingBook) {
        throw createError('Book not found', 404, 'BOOK_NOT_FOUND');
      }

      const book = BookQueries.updateBookProgress(bookId, req.body);
      res.json({ book });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/books/:id/status - Update book status
router.put('/:id/status',
  validateParams(bookIdSchema),
  validateBody(schemas.updateBookStatus),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;
      
      // Check if book exists
      const existingBook = BookQueries.getBookById(bookId);
      if (!existingBook) {
        throw createError('Book not found', 404, 'BOOK_NOT_FOUND');
      }

      const book = BookQueries.updateBookStatus(bookId, req.body);
      res.json({ book });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/books/reorder - Reorder books
router.put('/reorder',
  validateBody(schemas.reorderBooks),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { bookIds } = req.body;
      
      // Validate that all book IDs exist
      for (const bookId of bookIds) {
        const book = BookQueries.getBookById(bookId);
        if (!book) {
          throw createError(`Book with ID ${bookId} not found`, 404, 'BOOK_NOT_FOUND');
        }
      }

      BookQueries.reorderBooks(bookIds);
      
      // Return updated books
      const books = BookQueries.getAllBooks();
      res.json({ books });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/books/:id/highlights - Get highlights for a book
router.get('/:id/highlights',
  validateParams(bookIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;
      
      // Check if book exists
      const book = BookQueries.getBookById(bookId);
      if (!book) {
        throw createError('Book not found', 404, 'BOOK_NOT_FOUND');
      }

      const highlights = HighlightQueries.getHighlightsByBookId(bookId);
      res.json({ highlights });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/books/:id/highlights - Add highlight to book
router.post('/:id/highlights',
  validateParams(bookIdSchema),
  validateBody(schemas.createHighlight),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;
      
      // Check if book exists
      const book = BookQueries.getBookById(bookId);
      if (!book) {
        throw createError('Book not found', 404, 'BOOK_NOT_FOUND');
      }

      const highlight = HighlightQueries.createHighlight(bookId, req.body);
      res.status(201).json({ highlight });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/books/:id - Delete book
router.delete('/:id',
  validateParams(bookIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;
      
      const deleted = BookQueries.deleteBook(bookId);
      if (!deleted) {
        throw createError('Book not found', 404, 'BOOK_NOT_FOUND');
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  }
);

export { router as booksRouter };