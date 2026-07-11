// Core data model interfaces for Personal Reading Tracker

export type ReadingStatus = 'not_started' | 'in_progress' | 'completed' | 'did_not_finish';

export interface Book {
  id: number;
  title: string;
  authors: string[];
  position: number;
  status: ReadingStatus;
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

export interface ReviewHighlight extends Highlight {
  bookTitle: string;
  bookAuthors: string[];
  lastReviewedAt?: string;
  nextReviewAt?: string;
  reviewCount: number;
  favorite: boolean;
}

export type ReviewAction = 'read' | 'later' | 'favorite' | 'archive';

export interface ReviewSummary {
  totalHighlights: number;
  dueCount: number;
  reviewedToday: number;
  favoriteCount: number;
  archivedCount: number;
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
  status?: ReadingStatus;
  totalPages?: number;
  coverImageUrl?: string;
}

export interface UpdateBookProgressRequest {
  currentPage?: number;
  progressPercentage?: number;
  totalPages?: number;
  status?: ReadingStatus;
  startedDate?: string;
  completedDate?: string;
  personalRating?: number;
  personalReview?: string;
}

export interface UpdateBookStatusRequest {
  status: ReadingStatus;
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
  status?: ReadingStatus;
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
  status: ReadingStatus;
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
