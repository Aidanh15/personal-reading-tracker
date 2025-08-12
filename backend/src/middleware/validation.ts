import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { createError } from './errorHandler';

// Validation schemas for API requests
export const schemas = {
  // Book schemas
  createBook: z.object({
    title: z.string().min(1, 'Title is required').max(500, 'Title too long'),
    authors: z.array(z.string().min(1, 'Author name cannot be empty')).min(1, 'At least one author is required'),
    position: z.number().int().positive().optional(),
    totalPages: z.number().int().positive().optional(),
    coverImageUrl: z.string().url().optional()
  }),

  updateBookProgress: z.object({
    currentPage: z.number().int().min(0).optional(),
    progressPercentage: z.number().int().min(0).max(100).optional(),
    totalPages: z.number().int().positive().optional()
  }),

  updateBookStatus: z.object({
    status: z.enum(['not_started', 'in_progress', 'completed']),
    startedDate: z.string().datetime().optional(),
    completedDate: z.string().datetime().optional()
  }),

  reorderBooks: z.object({
    bookIds: z.array(z.number().int().positive()).min(1, 'At least one book ID is required')
  }),

  // Highlight schemas
  createHighlight: z.object({
    quoteText: z.string().min(1, 'Quote text is required').max(10000, 'Quote text too long'),
    pageNumber: z.number().int().positive().optional(),
    location: z.string().max(200).optional(),
    personalNotes: z.string().max(5000).optional(),
    highlightDate: z.string().datetime().optional()
  }),

  updateHighlight: z.object({
    quoteText: z.string().min(1, 'Quote text is required').max(10000, 'Quote text too long').optional(),
    pageNumber: z.number().int().positive().optional(),
    location: z.string().max(200).optional(),
    personalNotes: z.string().max(5000).optional()
  }),

  // Search schema
  searchQuery: z.object({
    q: z.string().max(500, 'Search query too long').optional(),
    status: z.enum(['not_started', 'in_progress', 'completed']).optional(),
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
    sortBy: z.enum(['relevance', 'title', 'date', 'dateAdded', 'progress', 'status', 'position', 'book', 'page']).default('relevance'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    limit: z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).refine(n => n > 0, 'Limit must be greater than 0').default('50'),
    offset: z.string().regex(/^\d+$/, 'Offset must be a number').transform(Number).refine(n => n >= 0, 'Offset must be non-negative').default('0')
  }),

  // Kindle import schemas
  kindleImport: z.object({
    content: z.string().min(1, 'Kindle highlights content is required')
  }),

  kindleImportConfirmation: z.object({
    categorizations: z.array(z.object({
      bookIndex: z.number().int().min(0),
      status: z.enum(['not_started', 'in_progress', 'completed']),
      position: z.number().int().positive().optional()
    })).min(1, 'At least one book categorization is required')
  })
};

// Generic validation middleware factory
export const validateRequest = (schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      const data = source === 'body' ? req.body : 
                   source === 'query' ? req.query : 
                   req.params;

      const validatedData = schema.parse(data);
      
      // Replace the original data with validated data
      if (source === 'body') {
        req.body = validatedData;
      } else if (source === 'query') {
        req.query = validatedData;
      } else {
        req.params = validatedData;
      }
      
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const validationErrors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code
        }));

        const validationError = createError(
          'Validation failed',
          400,
          'VALIDATION_ERROR',
          { errors: validationErrors }
        );

        next(validationError);
      } else {
        next(error);
      }
    }
  };
};

// Specific validation middleware for common use cases
export const validateBody = (schema: ZodSchema) => validateRequest(schema, 'body');
export const validateQuery = (schema: ZodSchema) => validateRequest(schema, 'query');
export const validateParams = (schema: ZodSchema) => validateRequest(schema, 'params');