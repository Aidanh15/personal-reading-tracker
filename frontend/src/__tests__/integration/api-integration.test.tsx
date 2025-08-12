import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BooksProvider, useBooks } from '../../contexts/BooksContext';
import { HighlightsProvider, useHighlights } from '../../contexts/HighlightsContext';
import { booksApi, highlightsApi, ApiRequestError } from '../../services/api';
import { Book, Highlight, ProgressUpdateData, HighlightFormData } from '../../types';

// Mock the API modules
vi.mock('../../services/api', () => ({
  booksApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    updateProgress: vi.fn(),
    delete: vi.fn(),
    updatePositions: vi.fn(),
    getHighlights: vi.fn(),
    addHighlight: vi.fn(),
  },
  highlightsApi: {
    getAll: vi.fn(),
    getById: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  searchApi: {
    search: vi.fn(),
  },
  healthApi: {
    check: vi.fn(),
  },
  ApiRequestError: class extends Error {
    constructor(message: string, public status?: number, public code?: string, public details?: any) {
      super(message);
      this.name = 'ApiRequestError';
    }
  },
}));

// Test component that uses both contexts
function TestComponent() {
  const { books, loading: booksLoading, error: booksError, fetchBooks, updateBookProgress, deleteBook } = useBooks();
  const { 
    highlights, 
    loading: highlightsLoading, 
    error: highlightsError, 
    fetchHighlights, 
    addHighlight, 
    updateHighlight, 
    deleteHighlight,
    getHighlightsByBookId 
  } = useHighlights();

  const handleUpdateProgress = async () => {
    const progressData: ProgressUpdateData = {
      progressPercentage: 50,
      status: 'in_progress',
      currentPage: 100
    };
    await updateBookProgress(1, progressData);
  };

  const handleAddHighlight = async () => {
    const highlightData: HighlightFormData = {
      quoteText: 'Test quote',
      pageNumber: 10,
      location: 'Chapter 1',
      personalNotes: 'Great insight'
    };
    await addHighlight(1, highlightData);
  };

  const handleUpdateHighlight = async () => {
    await updateHighlight(1, { personalNotes: 'Updated notes' });
  };

  const handleDeleteHighlight = async () => {
    await deleteHighlight(1);
  };

  const handleDeleteBook = async () => {
    await deleteBook(1);
  };

  const bookHighlights = getHighlightsByBookId(1);

  return (
    <div>
      <div data-testid="books-loading">{booksLoading ? 'Loading books' : 'Books loaded'}</div>
      <div data-testid="highlights-loading">{highlightsLoading ? 'Loading highlights' : 'Highlights loaded'}</div>
      <div data-testid="books-error">{booksError || 'No books error'}</div>
      <div data-testid="highlights-error">{highlightsError || 'No highlights error'}</div>
      <div data-testid="books-count">{books.length}</div>
      <div data-testid="highlights-count">{Object.keys(highlights).length}</div>
      <div data-testid="book-highlights-count">{bookHighlights.length}</div>
      
      <button onClick={fetchBooks} data-testid="fetch-books">Fetch Books</button>
      <button onClick={() => fetchHighlights(1)} data-testid="fetch-highlights">Fetch Highlights</button>
      <button onClick={handleUpdateProgress} data-testid="update-progress">Update Progress</button>
      <button onClick={handleAddHighlight} data-testid="add-highlight">Add Highlight</button>
      <button onClick={handleUpdateHighlight} data-testid="update-highlight">Update Highlight</button>
      <button onClick={handleDeleteHighlight} data-testid="delete-highlight">Delete Highlight</button>
      <button onClick={handleDeleteBook} data-testid="delete-book">Delete Book</button>
    </div>
  );
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <BooksProvider>
      <HighlightsProvider>
        {children}
      </HighlightsProvider>
    </BooksProvider>
  );
}

describe('API Integration Tests', () => {
  const mockBooks: Book[] = [
    {
      id: 1,
      title: 'Test Book 1',
      authors: ['Author 1'],
      position: 1,
      status: 'not_started',
      progressPercentage: 0,
      currentPage: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      title: 'Test Book 2',
      authors: ['Author 2'],
      position: 2,
      status: 'in_progress',
      progressPercentage: 25,
      currentPage: 50,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ];

  const mockHighlights: Highlight[] = [
    {
      id: 1,
      bookId: 1,
      quoteText: 'Test highlight 1',
      pageNumber: 10,
      location: 'Chapter 1',
      personalNotes: 'Great insight',
      highlightDate: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      bookId: 1,
      quoteText: 'Test highlight 2',
      pageNumber: 25,
      location: 'Chapter 2',
      personalNotes: 'Another insight',
      highlightDate: '2024-01-01T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Books API Integration', () => {
    it('successfully fetches and displays books', async () => {
      const user = userEvent.setup();
      vi.mocked(booksApi.getAll).mockResolvedValue(mockBooks);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('books-count')).toHaveTextContent('0');

      await user.click(screen.getByTestId('fetch-books'));

      await waitFor(() => {
        expect(screen.getByTestId('books-count')).toHaveTextContent('2');
      });

      expect(booksApi.getAll).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('books-error')).toHaveTextContent('No books error');
    });

    it('handles API errors when fetching books', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to fetch books';
      vi.mocked(booksApi.getAll).mockRejectedValue(new ApiRequestError(errorMessage, 500, 'SERVER_ERROR'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('fetch-books'));

      await waitFor(() => {
        expect(screen.getByTestId('books-error')).toHaveTextContent(errorMessage);
      });

      expect(screen.getByTestId('books-count')).toHaveTextContent('0');
    });

    it('performs optimistic updates for book progress', async () => {
      const user = userEvent.setup();
      const updatedBook = { ...mockBooks[0], progressPercentage: 50, status: 'in_progress' as const } as Book;
      
      vi.mocked(booksApi.getAll).mockResolvedValue(mockBooks);
      vi.mocked(booksApi.updateProgress).mockResolvedValue(updatedBook);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // First fetch books
      await user.click(screen.getByTestId('fetch-books'));
      await waitFor(() => {
        expect(screen.getByTestId('books-count')).toHaveTextContent('2');
      });

      // Update progress - should be optimistic
      await user.click(screen.getByTestId('update-progress'));

      // Verify API was called
      await waitFor(() => {
        expect(booksApi.updateProgress).toHaveBeenCalledWith(1, {
          progressPercentage: 50,
          status: 'in_progress',
          currentPage: 100
        });
      });
    });

    it('reverts optimistic updates on API failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to update progress';
      
      vi.mocked(booksApi.getAll).mockResolvedValue(mockBooks);
      vi.mocked(booksApi.updateProgress).mockRejectedValue(new ApiRequestError(errorMessage, 500, 'SERVER_ERROR'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // First fetch books
      await user.click(screen.getByTestId('fetch-books'));
      await waitFor(() => {
        expect(screen.getByTestId('books-count')).toHaveTextContent('2');
      });

      // Update progress - should fail and revert
      await user.click(screen.getByTestId('update-progress'));

      await waitFor(() => {
        expect(screen.getByTestId('books-error')).toHaveTextContent(errorMessage);
      });
    });

    it('performs optimistic delete for books', async () => {
      const user = userEvent.setup();
      
      vi.mocked(booksApi.getAll).mockResolvedValue(mockBooks);
      vi.mocked(booksApi.delete).mockResolvedValue();

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // First fetch books
      await user.click(screen.getByTestId('fetch-books'));
      await waitFor(() => {
        expect(screen.getByTestId('books-count')).toHaveTextContent('2');
      });

      // Delete book - should be optimistic
      await user.click(screen.getByTestId('delete-book'));

      // Verify API was called
      await waitFor(() => {
        expect(booksApi.delete).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Highlights API Integration', () => {
    it('successfully fetches and displays highlights', async () => {
      const user = userEvent.setup();
      vi.mocked(booksApi.getHighlights).mockResolvedValue(mockHighlights);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('0');

      await user.click(screen.getByTestId('fetch-highlights'));

      await waitFor(() => {
        expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('2');
      });

      expect(booksApi.getHighlights).toHaveBeenCalledWith(1);
      expect(screen.getByTestId('highlights-error')).toHaveTextContent('No highlights error');
    });

    it('handles API errors when fetching highlights', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to fetch highlights';
      vi.mocked(booksApi.getHighlights).mockRejectedValue(new Error(errorMessage));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('fetch-highlights'));

      await waitFor(() => {
        expect(screen.getByTestId('highlights-error')).toHaveTextContent(errorMessage);
      });

      expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('0');
    });

    it('performs optimistic updates for adding highlights', async () => {
      const user = userEvent.setup();
      const newHighlight = {
        id: 3,
        bookId: 1,
        quoteText: 'Test quote',
        pageNumber: 10,
        location: 'Chapter 1',
        personalNotes: 'Great insight',
        highlightDate: '2024-01-01T00:00:00Z',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z'
      };
      
      vi.mocked(booksApi.getHighlights).mockResolvedValue(mockHighlights);
      vi.mocked(booksApi.addHighlight).mockResolvedValue(newHighlight);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // First fetch highlights
      await user.click(screen.getByTestId('fetch-highlights'));
      await waitFor(() => {
        expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('2');
      });

      // Add highlight - should be optimistic
      await user.click(screen.getByTestId('add-highlight'));

      // Should immediately show optimistic update
      expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('3');

      // Verify API was called
      await waitFor(() => {
        expect(booksApi.addHighlight).toHaveBeenCalledWith(1, {
          quoteText: 'Test quote',
          pageNumber: 10,
          location: 'Chapter 1',
          personalNotes: 'Great insight'
        });
      });
    });

    it('reverts optimistic updates on highlight add failure', async () => {
      const user = userEvent.setup();
      const errorMessage = 'Failed to add highlight';
      
      vi.mocked(booksApi.getHighlights).mockResolvedValue(mockHighlights);
      vi.mocked(booksApi.addHighlight).mockRejectedValue(new ApiRequestError(errorMessage, 500, 'SERVER_ERROR'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // First fetch highlights
      await user.click(screen.getByTestId('fetch-highlights'));
      await waitFor(() => {
        expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('2');
      });

      // Add highlight - should fail and revert
      await user.click(screen.getByTestId('add-highlight'));

      await waitFor(() => {
        expect(screen.getByTestId('highlights-error')).toHaveTextContent(errorMessage);
        expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('2');
      });
    });

    it('performs optimistic updates for highlight updates', async () => {
      const user = userEvent.setup();
      const updatedHighlight = { ...mockHighlights[0], personalNotes: 'Updated notes' } as Highlight;
      
      vi.mocked(booksApi.getHighlights).mockResolvedValue(mockHighlights);
      vi.mocked(highlightsApi.update).mockResolvedValue(updatedHighlight);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // First fetch highlights
      await user.click(screen.getByTestId('fetch-highlights'));
      await waitFor(() => {
        expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('2');
      });

      // Update highlight - should be optimistic
      await user.click(screen.getByTestId('update-highlight'));

      // Verify API was called
      await waitFor(() => {
        expect(highlightsApi.update).toHaveBeenCalledWith(1, { personalNotes: 'Updated notes' });
      });
    });

    it('performs optimistic delete for highlights', async () => {
      const user = userEvent.setup();
      
      vi.mocked(booksApi.getHighlights).mockResolvedValue(mockHighlights);
      vi.mocked(highlightsApi.delete).mockResolvedValue();

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      // First fetch highlights
      await user.click(screen.getByTestId('fetch-highlights'));
      await waitFor(() => {
        expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('2');
      });

      // Delete highlight - should be optimistic
      await user.click(screen.getByTestId('delete-highlight'));

      // Should immediately show optimistic update
      expect(screen.getByTestId('book-highlights-count')).toHaveTextContent('1');

      // Verify API was called
      await waitFor(() => {
        expect(highlightsApi.delete).toHaveBeenCalledWith(1);
      });
    });
  });

  describe('Error Handling and Recovery', () => {
    it('handles network errors gracefully', async () => {
      const user = userEvent.setup();
      vi.mocked(booksApi.getAll).mockRejectedValue(new ApiRequestError('Network error - please check your connection', undefined, 'NETWORK_ERROR'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('fetch-books'));

      await waitFor(() => {
        expect(screen.getByTestId('books-error')).toHaveTextContent('Network error - please check your connection');
      });
    });

    it('handles server errors with proper error messages', async () => {
      const user = userEvent.setup();
      vi.mocked(booksApi.getAll).mockRejectedValue(new ApiRequestError('Internal server error', 500, 'SERVER_ERROR'));

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('fetch-books'));

      await waitFor(() => {
        expect(screen.getByTestId('books-error')).toHaveTextContent('Internal server error');
      });
    });

    it('clears errors on successful operations', async () => {
      const user = userEvent.setup();
      
      // First, cause an error
      vi.mocked(booksApi.getAll).mockRejectedValueOnce(new Error('Initial error'));
      
      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('fetch-books'));
      await waitFor(() => {
        expect(screen.getByTestId('books-error')).toHaveTextContent('Initial error');
      });

      // Then, make it succeed
      vi.mocked(booksApi.getAll).mockResolvedValue(mockBooks);
      await user.click(screen.getByTestId('fetch-books'));

      await waitFor(() => {
        expect(screen.getByTestId('books-error')).toHaveTextContent('No books error');
        expect(screen.getByTestId('books-count')).toHaveTextContent('2');
      });
    });
  });

  describe('Loading States', () => {
    it('shows loading state during API calls', async () => {
      const user = userEvent.setup();
      
      // Create a promise that we can control
      let resolvePromise: (value: Book[]) => void;
      const promise = new Promise<Book[]>((resolve) => {
        resolvePromise = resolve;
      });
      
      vi.mocked(booksApi.getAll).mockReturnValue(promise);

      render(
        <TestWrapper>
          <TestComponent />
        </TestWrapper>
      );

      await user.click(screen.getByTestId('fetch-books'));

      // Should show loading state
      expect(screen.getByTestId('books-loading')).toHaveTextContent('Loading books');

      // Resolve the promise
      act(() => {
        resolvePromise!(mockBooks);
      });

      await waitFor(() => {
        expect(screen.getByTestId('books-loading')).toHaveTextContent('Books loaded');
      });
    });
  });
});