import { Request, Response, NextFunction } from 'express';
import { ApiError } from '../types';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export const errorHandler = (
  error: AppError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  // Log the error
  console.error('API Error:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Default error response
  const statusCode = error.statusCode || 500;
  const errorCode = error.code || 'INTERNAL_SERVER_ERROR';
  
  const errorResponse: { error: ApiError } = {
    error: {
      message: error.message || 'An unexpected error occurred',
      code: errorCode,
      details: error.details,
      timestamp: new Date().toISOString()
    }
  };

  // Don't expose internal error details in production
  if (process.env['NODE_ENV'] === 'production' && statusCode === 500) {
    errorResponse.error.message = 'Internal server error';
    delete errorResponse.error.details;
  }

  res.status(statusCode).json(errorResponse);
};

// Helper function to create standardized errors
export const createError = (
  message: string,
  statusCode: number = 500,
  code?: string,
  details?: any
): AppError => {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  if (code) error.code = code;
  error.details = details;
  return error;
};