// Core data model interfaces for Personal Reading Tracker

export interface Book {
  id: number;
  title: string;
  authors: string[];
  position: number;
  status: 'not_started' | 'in_progress' | 'completed';
  progressPercentage: number;
  totalPages?: number;
  currentPage: number;
  startedDate?: string;
  completedDate?: string;
  personalRating?: number;
  personalReview?: string;
  coverImageUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Highlight {
  id: number;
  bookId: number;
  quoteText: string;
  pageNumber?: number;
  location?: string;
  personalNotes?: string;
  highlightDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReadingSession {
  id: number;
  bookId: number;
  startTime: string;
  endTime?: string;
  pagesRead: number;
  notes?: string;
  createdAt: string;
}

// API request/response types
export interface CreateBookRequest {
  title: string;
  authors: string[];
  position?: number;
  totalPages?: number;
  coverImageUrl?: string;
}

export interface UpdateBookProgressRequest {
  currentPage?: number;
  progressPercentage?: number;
  totalPages?: number;
}

export interface UpdateBookStatusRequest {
  status: 'not_started' | 'in_progress' | 'completed';
  startedDate?: string;
  completedDate?: string;
}
export interface CreateHighlightRequest {
  quoteText: string;
  pageNumber?: number;
  location?: string;
  personalNotes?: string;
  highlightDate?: string;
}

export interface UpdateHighlightRequest {
  quoteText?: string;
  pageNumber?: number;
  location?: string;
  personalNotes?: string;
}

export interface ReorderBooksRequest {
  bookIds: number[];
}

export interface SearchRequest {
  query: string;
  type?: 'books' | 'highlights' | 'all';
  status?: 'not_started' | 'in_progress' | 'completed';
}

export interface SearchResult {
  books: Book[];
  highlights: (Highlight & { bookTitle: string; bookAuthors: string[] })[];
}

// Kindle import types
export interface KindleImportRequest {
  content: string;
}

export interface ParsedKindleBook {
  title: string;
  authors: string[];
  highlights: Omit<Highlight, 'id' | 'bookId' | 'createdAt' | 'updatedAt'>[];
}

export interface KindleImportPreview {
  books: ParsedKindleBook[];
}

export interface BookCategorization {
  bookIndex: number;
  status: 'not_started' | 'in_progress' | 'completed';
  position?: number;
}

export interface KindleImportConfirmation {
  categorizations: BookCategorization[];
}

// Error types
export interface ApiError {
  message: string;
  code: string;
  details?: any;
  timestamp: string;
}