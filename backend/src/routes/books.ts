import { Router, Request, Response, NextFunction } from 'express';
import { BookQueries } from '../database/queries/books';
import { HighlightQueries } from '../database/queries/highlights';
import { validateBody, validateParams, validateQuery, schemas } from '../middleware/validation';
import { CoverService } from '../services/coverService';
import { createError } from '../middleware/errorHandler';
import { z } from 'zod';

const router = Router();

// Parameter validation schema
const bookIdSchema = z.object({
  id: z.string().regex(/^\d+$/, 'Book ID must be a number').transform(Number)
});

// GET /api/books/lookup?q= - Candidate books (with covers) for adding to the list
router.get('/lookup',
  validateQuery(schemas.bookLookup),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const candidates = await CoverService.searchCandidates(String(req.query['q']));
      res.json({ candidates });
    } catch (error) {
      next(error);
    }
  }
);

// POST /api/books/up-next - Add a book to the end of Up Next, fetching its cover
router.post('/up-next',
  validateBody(schemas.addToUpNext),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { title, authors, coverUrl, category, milestone } = req.body;
      const cover = coverUrl
        ? await CoverService.downloadCover({ title, authors, coverUrl })
        : await CoverService.getCoverForBook(title, authors);

      const tail = BookQueries.getUpNextTail();
      const book = BookQueries.createBook({
        title,
        authors,
        position: tail.position,
        ...(tail.phase ? { phase: tail.phase } : {}),
        ...(category ? { category } : {}),
        ...(milestone ? { milestone } : {}),
        ...(cover.localPath ? { coverImageUrl: cover.localPath } : {})
      });
      res.status(201).json({ book });
    } catch (error) {
      next(error);
    }
  }
);

// PUT /api/books/up-next - Save the Up Next order (and each book's phase)
router.put('/up-next',
  validateBody(schemas.saveUpNextOrder),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      try {
        BookQueries.saveUpNextOrder(req.body.order);
      } catch (error) {
        throw createError(error instanceof Error ? error.message : 'Invalid order', 409, 'UP_NEXT_CHANGED');
      }
      res.json({ books: BookQueries.getAllBooks() });
    } catch (error) {
      next(error);
    }
  }
);

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

const reorderBooksHandler = async (req: Request, res: Response, next: NextFunction) => {
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
};

// PUT /api/books/reorder - Reorder books
router.put('/reorder',
  validateBody(schemas.reorderBooks),
  reorderBooksHandler
);

// PUT /api/books/positions - Backward-compatible frontend alias
router.put('/positions',
  validateBody(schemas.reorderBooks),
  reorderBooksHandler
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

// PUT /api/books/:id/schedule - Move a not-started book off Up Next or back onto it
router.put('/:id/schedule',
  validateParams(bookIdSchema),
  validateBody(schemas.setUnscheduled),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;
      const book = BookQueries.getBookById(bookId);
      if (!book) {
        throw createError('Book not found', 404, 'BOOK_NOT_FOUND');
      }
      if (book.status !== 'not_started' || book.parallelTrack) {
        throw createError('Only not-started books on the list can be unscheduled', 409, 'NOT_SCHEDULABLE');
      }

      res.json({ book: BookQueries.setUnscheduled(bookId, req.body.unscheduled) });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/books/:id - Delete book (refused while it has highlights, which would be lost)
router.delete('/:id',
  validateParams(bookIdSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const bookId = req.params['id'] as unknown as number;

      const highlightCount = BookQueries.countHighlights(bookId);
      if (highlightCount > 0) {
        throw createError(
          `This book has ${highlightCount} highlight${highlightCount === 1 ? '' : 's'}; move it to Unscheduled instead`,
          409,
          'BOOK_HAS_HIGHLIGHTS'
        );
      }

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
