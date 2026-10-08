// Book types
export type ReadingStatus = 'not_started' | 'in_progress' | 'completed' | 'did_not_finish';

export interface Book {
  id: number;
  title: string;
  authors: string[];
  position: number;
  status: ReadingStatus;
  progressPercentage: number;
  totalPages?: number;
  currentPage?: number;
  startedDate?: string;
  completedDate?: string;
  personalRating?: number;
  personalReview?: string;
  coverImageUrl?: string;
  phase?: string | null;
  milestone?: string | null;
  category?: string | null;
  parallelTrack: boolean;
  unscheduled: boolean;
  createdAt: string;
  updatedAt: string;
}

// A search result offered when adding a book to the list
export interface BookCandidate {
  title: string;
  authors: string[];
  year?: number;
  coverUrl?: string;
}

export interface AddToUpNextData {
  title: string;
  authors: string[];
  coverUrl?: string;
}

// Highlight types
export interface Highlight {
  id: number;
  bookId: number;
  quoteText: string;
  pageNumber?: number;
  location?: string;
  personalNotes?: string;
  highlightDate: string;
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

// Extended highlight type for search results
export interface HighlightWithBook extends Highlight {
  bookTitle: string;
  bookAuthors: string[];
}

// Search types
export interface SearchResult {
  books: Book[];
  highlights: HighlightWithBook[];
  totalResults: number;
  query: string;
  filters: {
    status?: string;
    dateRange?: {
      start?: string;
      end?: string;
    };
    sortBy?: string;
    sortOrder?: string;
  };
}

// API response types
export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface ApiError {
  error: {
    message: string;
    code: string;
    timestamp: string;
    details?: any;
  };
}

// Form types
export interface BookFormData {
  title: string;
  authors: string[];
  totalPages?: number;
  status: Book['status'];
}

export interface HighlightFormData {
  quoteText: string;
  pageNumber?: number | undefined;
  location?: string | undefined;
  personalNotes?: string | undefined;
}

export interface ProgressUpdateData {
  currentPage?: number | undefined;
  progressPercentage: number;
  status: Book['status'];
  completedDate?: string | undefined;
  personalRating?: number | undefined;
  personalReview?: string | undefined;
}

// Context types
export interface BooksContextType {
  books: Book[];
  loading: boolean;
  error: string | null;
  fetchBooks: () => Promise<void>;
  getBookById: (id: number) => Book | undefined;
  updateBookProgress: (id: number, data: ProgressUpdateData) => Promise<void>;
  addBook: (data: BookFormData) => Promise<void>;
  deleteBook: (id: number) => Promise<void>;
  updateBookPositions: (bookIds: number[]) => Promise<void>;
}

export interface HighlightsContextType {
  highlights: Record<number, Highlight[]>; // bookId -> highlights
  loading: boolean;
  error: string | null;
  fetchHighlights: (bookId: number) => Promise<void>;
  addHighlight: (bookId: number, data: HighlightFormData) => Promise<void>;
  updateHighlight: (id: number, data: Partial<HighlightFormData>) => Promise<void>;
  deleteHighlight: (id: number) => Promise<void>;
  bulkImportHighlights: (bookId: number, highlights: HighlightFormData[]) => Promise<void>;
  getHighlightsByBookId: (bookId: number) => Highlight[];
}

// Component prop types
export interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export interface ProgressTrackerProps {
  book: Book;
  onUpdateProgress: (data: ProgressUpdateData) => Promise<void>;
  loading?: boolean;
}

export interface BookCardProps {
  book: Book;
  onClick?: (book: Book) => void;
}

export interface HighlightCardProps {
  highlight: Highlight;
  onEdit?: (highlight: Highlight) => void;
  onDelete?: (id: number) => void;
  showBookInfo?: boolean;
}

// Search and filter types
export interface SearchFilters {
  query?: string;
  status?: Book['status'];
  startDate?: string;
  endDate?: string;
  sortBy?: 'relevance' | 'title' | 'date' | 'dateAdded' | 'progress' | 'status' | 'position' | 'book' | 'page';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

// Discuss with Claude
export type DiscussionStatus = 'active' | 'reviewed';

export interface Discussion {
  id: number;
  bookId: number;
  claudeSessionId: string;
  status: DiscussionStatus;
  model: string | null;
  reviewDraft: string | null;
  reviewRating: number | null;
  appliedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DiscussionMessage {
  id: number;
  discussionId: number;
  role: 'user' | 'assistant';
  kind: 'chat' | 'review';
  content: string;
  createdAt: string;
}
