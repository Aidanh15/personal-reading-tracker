import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { Book, BooksContextType, BookFormData, ProgressUpdateData } from '../types';
import { booksApi, ApiRequestError } from '../services/api';

// Action types
type BooksAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_BOOKS'; payload: Book[] }
  | { type: 'ADD_BOOK'; payload: Book }
  | { type: 'UPDATE_BOOK'; payload: Book }
  | { type: 'DELETE_BOOK'; payload: number }
  | { type: 'UPDATE_POSITIONS'; payload: Book[] }
  | { type: 'OPTIMISTIC_UPDATE_BOOK'; payload: Book }
  | { type: 'OPTIMISTIC_DELETE_BOOK'; payload: number }
  | { type: 'REVERT_OPTIMISTIC_UPDATE'; payload: Book[] };

// State type
interface BooksState {
  books: Book[];
  loading: boolean;
  error: string | null;
  optimisticUpdates: Map<number, Book>; // Track optimistic updates for rollback
}

// Initial state
const initialState: BooksState = {
  books: [],
  loading: false,
  error: null,
  optimisticUpdates: new Map(),
};

// Reducer
function booksReducer(state: BooksState, action: BooksAction): BooksState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };

    case 'SET_BOOKS':
      return {
        ...state,
        books: action.payload,
        loading: false,
        error: null,
        optimisticUpdates: new Map() // Clear optimistic updates when fresh data arrives
      };

    case 'ADD_BOOK':
      return {
        ...state,
        books: [...state.books, action.payload].sort((a, b) => a.position - b.position),
        loading: false,
        error: null
      };

    case 'UPDATE_BOOK':
      const newOptimisticUpdates = new Map(state.optimisticUpdates);
      newOptimisticUpdates.delete(action.payload.id); // Remove from optimistic updates

      return {
        ...state,
        books: state.books.map(book =>
          book.id === action.payload.id ? action.payload : book
        ),
        optimisticUpdates: newOptimisticUpdates,
        loading: false,
        error: null
      };

    case 'DELETE_BOOK':
      return {
        ...state,
        books: state.books.filter(book => book.id !== action.payload),
        loading: false,
        error: null
      };

    case 'UPDATE_POSITIONS':
      return {
        ...state,
        books: action.payload.sort((a, b) => a.position - b.position),
        loading: false,
        error: null
      };

    case 'OPTIMISTIC_UPDATE_BOOK':
      const originalBook = state.books.find(book => book.id === action.payload.id);
      const updatedOptimisticMap = new Map(state.optimisticUpdates);

      if (originalBook && !updatedOptimisticMap.has(action.payload.id)) {
        updatedOptimisticMap.set(action.payload.id, originalBook);
      }

      return {
        ...state,
        books: state.books.map(book =>
          book.id === action.payload.id ? action.payload : book
        ),
        optimisticUpdates: updatedOptimisticMap,
        error: null
      };

    case 'OPTIMISTIC_DELETE_BOOK':
      const bookToDelete = state.books.find(book => book.id === action.payload);
      const deleteOptimisticMap = new Map(state.optimisticUpdates);

      if (bookToDelete) {
        deleteOptimisticMap.set(action.payload, bookToDelete);
      }

      return {
        ...state,
        books: state.books.filter(book => book.id !== action.payload),
        optimisticUpdates: deleteOptimisticMap,
        error: null
      };

    case 'REVERT_OPTIMISTIC_UPDATE':
      return {
        ...state,
        books: action.payload,
        optimisticUpdates: new Map(),
        loading: false
      };

    default:
      return state;
  }
}

// Create context
const BooksContext = createContext<BooksContextType | undefined>(undefined);

// Provider component
interface BooksProviderProps {
  children: ReactNode;
}

export function BooksProvider({ children }: BooksProviderProps) {
  const [state, dispatch] = useReducer(booksReducer, initialState);

  // Fetch all books
  const fetchBooks = useCallback(async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const books = await booksApi.getAll();
      dispatch({ type: 'SET_BOOKS', payload: books });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch books';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  // Get book by ID
  const getBookById = useCallback((id: number): Book | undefined => {
    return state.books.find(book => book.id === id);
  }, [state.books]);

  // Update book progress with optimistic updates
  const updateBookProgress = useCallback(async (id: number, data: ProgressUpdateData) => {
    const currentBook = state.books.find(book => book.id === id);
    if (!currentBook) {
      dispatch({ type: 'SET_ERROR', payload: 'Book not found' });
      return;
    }

    // Create optimistic update, filtering out undefined values
    const filteredData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    ) as Partial<Book>;

    const optimisticBook: Book = {
      ...currentBook,
      ...filteredData,
      updatedAt: new Date().toISOString()
    };

    // Apply optimistic update immediately
    dispatch({ type: 'OPTIMISTIC_UPDATE_BOOK', payload: optimisticBook });

    try {
      const updatedBook = await booksApi.updateProgress(id, data);
      dispatch({ type: 'UPDATE_BOOK', payload: updatedBook });
    } catch (error) {
      // Revert optimistic update on error
      const originalBooks = [...state.books];
      const originalBook = state.optimisticUpdates.get(id);
      if (originalBook) {
        const revertedBooks = originalBooks.map(book =>
          book.id === id ? originalBook : book
        );
        dispatch({ type: 'REVERT_OPTIMISTIC_UPDATE', payload: revertedBooks });
      }

      const errorMessage = error instanceof ApiRequestError
        ? error.message
        : 'Failed to update book progress';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [state.books, state.optimisticUpdates]);

  // Add new book
  const addBook = useCallback(async (data: BookFormData) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const newBook = await booksApi.create(data);
      dispatch({ type: 'ADD_BOOK', payload: newBook });
    } catch (error) {
      const errorMessage = error instanceof ApiRequestError
        ? error.message
        : 'Failed to add book';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  // Delete book with optimistic updates
  const deleteBook = useCallback(async (id: number) => {
    // Apply optimistic delete immediately
    dispatch({ type: 'OPTIMISTIC_DELETE_BOOK', payload: id });

    try {
      await booksApi.delete(id);
      dispatch({ type: 'DELETE_BOOK', payload: id });
    } catch (error) {
      // Revert optimistic delete on error
      const originalBooks = [...state.books];
      const originalBook = state.optimisticUpdates.get(id);
      if (originalBook) {
        const revertedBooks = [...originalBooks.filter(book => book.id !== id), originalBook]
          .sort((a, b) => a.position - b.position);
        dispatch({ type: 'REVERT_OPTIMISTIC_UPDATE', payload: revertedBooks });
      }

      const errorMessage = error instanceof ApiRequestError
        ? error.message
        : 'Failed to delete book';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [state.books, state.optimisticUpdates]);

  // Update book positions (for reordering)
  const updateBookPositions = useCallback(async (bookIds: number[]) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      await booksApi.updatePositions(bookIds);

      // Update local state with new positions
      const updatedBooks = state.books.map(book => {
        const newPosition = bookIds.indexOf(book.id) + 1;
        return newPosition > 0 ? { ...book, position: newPosition } : book;
      });

      dispatch({ type: 'UPDATE_POSITIONS', payload: updatedBooks });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update book positions';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [state.books]);

  const contextValue: BooksContextType = {
    books: state.books,
    loading: state.loading,
    error: state.error,
    fetchBooks,
    getBookById,
    updateBookProgress,
    addBook,
    deleteBook,
    updateBookPositions,
  };

  return (
    <BooksContext.Provider value={contextValue}>
      {children}
    </BooksContext.Provider>
  );
}

// Custom hook to use the context
export function useBooks(): BooksContextType {
  const context = useContext(BooksContext);
  if (context === undefined) {
    throw new Error('useBooks must be used within a BooksProvider');
  }
  return context;
}