import { z } from 'zod';
import { ratingSchema } from '../middleware/validation';

export const idParamSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID must be a number').transform(Number)
});

// content null = retry the reader's unanswered message
export const messageBodySchema = z.object({
  content: z.string().trim().min(1).max(10000).nullable()
});

export const reviewBodySchema = z.object({
  instructions: z.string().trim().max(2000).optional()
});

export const draftBodySchema = z.object({
  draft: z.string().max(10000),
  rating: ratingSchema.nullable()
});
