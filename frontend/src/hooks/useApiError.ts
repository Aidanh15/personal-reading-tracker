import { useCallback } from 'react';
import { useNotification } from '../contexts/NotificationContext';
import { ApiRequestError } from '../services/api';

export interface ApiErrorHandlerOptions {
  showToast?: boolean;
  customMessage?: string;
  onError?: (error: ApiRequestError) => void;
}

export const useApiError = () => {
  const { showError, showWarning } = useNotification();

  const handleError = useCallback((
    error: unknown,
    options: ApiErrorHandlerOptions = {}
  ) => {
    const {
      showToast = true,
      customMessage,
      onError
    } = options;

    let title = 'An error occurred';
    let message = 'Please try again later';

    if (error instanceof ApiRequestError) {
      title = customMessage || error.message;
      
      // Provide more specific messages based on error codes
      switch (error.code) {
        case 'NETWORK_ERROR':
          title = 'Connection Error';
          message = 'Please check your internet connection and try again';
          break;
        case 'VALIDATION_ERROR':
          title = 'Invalid Data';
          message = 'Please check your input and try again';
          break;
        case 'NOT_FOUND':
          title = 'Not Found';
          message = 'The requested item could not be found';
          break;
        case 'UNAUTHORIZED':
          title = 'Access Denied';
          message = 'You do not have permission to perform this action';
          break;
        case 'SERVER_ERROR':
          title = 'Server Error';
          message = 'Something went wrong on our end. Please try again later';
          break;
        default:
          if (error.status) {
            message = `Error ${error.status}: ${error.message}`;
          }
      }

      if (onError) {
        onError(error);
      }
    } else if (error instanceof Error) {
      title = customMessage || error.message;
      message = 'An unexpected error occurred';
    }

    if (showToast) {
      // Use warning for client-side errors, error for server errors
      if (error instanceof ApiRequestError && error.status && error.status < 500) {
        showWarning(title, message);
      } else {
        showError(title, message);
      }
    }

    // Log error for debugging
    console.error('API Error:', error);
  }, [showError, showWarning]);

  return { handleError };
};