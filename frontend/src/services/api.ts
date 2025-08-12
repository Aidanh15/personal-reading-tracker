import axios, { AxiosResponse, AxiosError } from 'axios';
import { 
  Book, 
  Highlight, 
  SearchResult, 
  BookFormData, 
  HighlightFormData, 
  ProgressUpdateData,
  SearchFilters,
  ApiError 
} from '../types';

// Extend axios config to include metadata
declare module 'axios' {
  interface InternalAxiosRequestConfig {
    metadata?: {
      requestId: string;
      startTime: number;
    };
  }
}

// Enhanced error class for API errors
export class ApiRequestError extends Error {
  public readonly status?: number | undefined;
  public readonly code?: string | undefined;
  public readonly details?: any;

  constructor(message: string, status?: number | undefined, code?: string | undefined, details?: any) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  retryDelay: 1000,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

// Retry utility function
const retryRequest = async <T>(
  requestFn: () => Promise<T>,
  retries = RETRY_CONFIG.maxRetries
): Promise<T> => {
  try {
    return await requestFn();
  } catch (error) {
    if (retries > 0 && shouldRetry(error)) {
      await new Promise(resolve => setTimeout(resolve, RETRY_CONFIG.retryDelay));
      return retryRequest(requestFn, retries - 1);
    }
    throw error;
  }
};

// Check if error should be retried
const shouldRetry = (error: any): boolean => {
  if (axios.isAxiosError(error)) {
    const status = error.response?.status;
    return status ? RETRY_CONFIG.retryableStatuses.includes(status) : true;
  }
  return false;
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: '/api',
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for logging and request ID
api.interceptors.request.use(
  (config) => {
    const requestId = Math.random().toString(36).substring(2, 11);
    config.metadata = { requestId, startTime: Date.now() };
    console.log(`[${requestId}] API Request: ${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => {
    console.error('API Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response) => {
    const { requestId, startTime } = response.config.metadata || {};
    const duration = Date.now() - (startTime || 0);
    console.log(`[${requestId}] API Response: ${response.status} (${duration}ms)`);
    return response;
  },
  (error: AxiosError) => {
    const { requestId, startTime } = error.config?.metadata || {};
    const duration = Date.now() - (startTime || 0);
    console.error(`[${requestId}] API Error: ${error.response?.status || 'Network'} (${duration}ms)`, error);
    
    // Handle network errors
    if (!error.response) {
      throw new ApiRequestError(
        'Network error - please check your connection',
        undefined,
        'NETWORK_ERROR'
      );
    }
    
    // Handle API errors
    const status = error.response.status;
    const apiError = error.response.data as ApiError;
    
    throw new ApiRequestError(
      apiError?.error?.message || `Request failed with status ${status}`,
      status,
      apiError?.error?.code || 'API_ERROR',
      apiError?.error?.details
    );
  }
);

// Books API with retry logic
export const booksApi = {
  // Get all books
  async getAll(): Promise<Book[]> {
    return retryRequest(async () => {
      const response: AxiosResponse<{books: Book[]}> = await api.get('/books');
      return response.data.books;
    });
  },

  // Get book by ID
  async getById(id: number): Promise<Book> {
    return retryRequest(async () => {
      const response: AxiosResponse<{book: Book}> = await api.get(`/books/${id}`);
      return response.data.book;
    });
  },

  // Add new book
  async create(data: BookFormData): Promise<Book> {
    return retryRequest(async () => {
      const response: AxiosResponse<{book: Book}> = await api.post('/books', data);
      return response.data.book;
    });
  },

  // Update book progress
  async updateProgress(id: number, data: ProgressUpdateData): Promise<Book> {
    return retryRequest(async () => {
      const response: AxiosResponse<{book: Book}> = await api.put(`/books/${id}/progress`, data);
      return response.data.book;
    });
  },

  // Delete book
  async delete(id: number): Promise<void> {
    return retryRequest(async () => {
      await api.delete(`/books/${id}`);
    });
  },

  // Update book positions (for reordering)
  async updatePositions(bookIds: number[]): Promise<void> {
    return retryRequest(async () => {
      await api.put('/books/positions', { bookIds });
    });
  },

  // Get book highlights
  async getHighlights(id: number): Promise<Highlight[]> {
    return retryRequest(async () => {
      const response: AxiosResponse<{highlights: Highlight[]}> = await api.get(`/books/${id}/highlights`);
      return response.data.highlights;
    });
  },

  // Add highlight to book
  async addHighlight(id: number, data: HighlightFormData): Promise<Highlight> {
    return retryRequest(async () => {
      const response: AxiosResponse<{highlight: Highlight}> = await api.post(`/books/${id}/highlights`, data);
      return response.data.highlight;
    });
  },
};

// Highlights API with retry logic
export const highlightsApi = {
  // Get all highlights
  async getAll(): Promise<Highlight[]> {
    return retryRequest(async () => {
      const response: AxiosResponse<Highlight[]> = await api.get('/highlights');
      return response.data;
    });
  },

  // Get highlight by ID
  async getById(id: number): Promise<Highlight> {
    return retryRequest(async () => {
      const response: AxiosResponse<Highlight> = await api.get(`/highlights/${id}`);
      return response.data;
    });
  },

  // Update highlight
  async update(id: number, data: Partial<HighlightFormData>): Promise<Highlight> {
    return retryRequest(async () => {
      const response: AxiosResponse<Highlight> = await api.put(`/highlights/${id}`, data);
      return response.data;
    });
  },

  // Delete highlight
  async delete(id: number): Promise<void> {
    return retryRequest(async () => {
      await api.delete(`/highlights/${id}`);
    });
  },
};

// Search API with retry logic
export const searchApi = {
  // Search books and highlights
  async search(filters: SearchFilters): Promise<SearchResult> {
    return retryRequest(async () => {
      const params = new URLSearchParams();
      
      if (filters.query) params.append('q', filters.query);
      if (filters.status) params.append('status', filters.status);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
      if (filters.sortBy) params.append('sortBy', filters.sortBy);
      if (filters.sortOrder) params.append('sortOrder', filters.sortOrder);
      if (filters.limit) params.append('limit', filters.limit.toString());
      if (filters.offset) params.append('offset', filters.offset.toString());

      const response: AxiosResponse<SearchResult> = await api.get(`/search?${params.toString()}`);
      return response.data;
    });
  },
};

// Health check with retry logic
export const healthApi = {
  async check(): Promise<{ status: string; timestamp: string }> {
    return retryRequest(async () => {
      const response = await api.get('/health');
      return response.data;
    });
  },
};

export default api;