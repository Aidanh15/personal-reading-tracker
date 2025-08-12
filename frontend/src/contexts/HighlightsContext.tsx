import { createContext, useContext, useReducer, useCallback, ReactNode } from 'react';
import { Highlight, HighlightsContextType, HighlightFormData } from '../types';
import { booksApi, highlightsApi, ApiRequestError } from '../services/api';

// Action types
type HighlightsAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_HIGHLIGHTS'; payload: { bookId: number; highlights: Highlight[] } }
  | { type: 'ADD_HIGHLIGHT'; payload: Highlight }
  | { type: 'ADD_BULK_HIGHLIGHTS'; payload: { bookId: number; highlights: Highlight[] } }
  | { type: 'UPDATE_HIGHLIGHT'; payload: Highlight }
  | { type: 'DELETE_HIGHLIGHT'; payload: { id: number; bookId: number } }
  | { type: 'OPTIMISTIC_ADD_HIGHLIGHT'; payload: Highlight }
  | { type: 'OPTIMISTIC_UPDATE_HIGHLIGHT'; payload: Highlight }
  | { type: 'OPTIMISTIC_DELETE_HIGHLIGHT'; payload: { id: number; bookId: number } }
  | { type: 'REVERT_OPTIMISTIC_UPDATE'; payload: { bookId: number; highlights: Highlight[] } };

// State type
interface HighlightsState {
  highlights: Record<number, Highlight[]>; // bookId -> highlights
  loading: boolean;
  error: string | null;
  optimisticUpdates: Map<number, Highlight[]>; // Track original state for rollback
}

// Initial state
const initialState: HighlightsState = {
  highlights: {},
  loading: false,
  error: null,
  optimisticUpdates: new Map(),
};

// Reducer
function highlightsReducer(state: HighlightsState, action: HighlightsAction): HighlightsState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_HIGHLIGHTS':
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [action.payload.bookId]: action.payload.highlights
        },
        loading: false,
        error: null
      };
    
    case 'ADD_HIGHLIGHT':
      const bookId = action.payload.bookId;
      const existingHighlights = state.highlights[bookId] || [];
      const newOptimisticUpdates = new Map(state.optimisticUpdates);
      newOptimisticUpdates.delete(bookId); // Remove from optimistic updates since this is the real data
      
      // Filter out any optimistic highlights (temporary IDs) and add the real highlight
      const realHighlights = existingHighlights.filter(h => h.id < 1000000000000); // Filter out Date.now() IDs
      
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [bookId]: [...realHighlights, action.payload].sort((a, b) => {
            // Sort by page number first, then by creation date
            if (a.pageNumber && b.pageNumber) {
              return a.pageNumber - b.pageNumber;
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })
        },
        optimisticUpdates: newOptimisticUpdates,
        loading: false,
        error: null
      };
    
    case 'ADD_BULK_HIGHLIGHTS':
      const bulkBookId = action.payload.bookId;
      const currentHighlights = state.highlights[bulkBookId] || [];
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [bulkBookId]: [...currentHighlights, ...action.payload.highlights].sort((a, b) => {
            // Sort by page number first, then by creation date
            if (a.pageNumber && b.pageNumber) {
              return a.pageNumber - b.pageNumber;
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })
        },
        loading: false,
        error: null
      };
    
    case 'UPDATE_HIGHLIGHT':
      const updatedHighlight = action.payload;
      const targetBookId = updatedHighlight.bookId;
      const bookHighlights = state.highlights[targetBookId] || [];
      
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [targetBookId]: bookHighlights.map(highlight =>
            highlight.id === updatedHighlight.id ? updatedHighlight : highlight
          )
        },
        loading: false,
        error: null
      };
    
    case 'DELETE_HIGHLIGHT':
      const { id, bookId: deleteBookId } = action.payload;
      const remainingHighlights = (state.highlights[deleteBookId] || []).filter(
        highlight => highlight.id !== id
      );
      
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [deleteBookId]: remainingHighlights
        },
        loading: false,
        error: null
      };
    
    case 'OPTIMISTIC_ADD_HIGHLIGHT':
      const optimisticBookId = action.payload.bookId;
      const currentBookHighlights = state.highlights[optimisticBookId] || [];
      
      // Store original state for potential rollback
      const addOptimisticUpdates = new Map(state.optimisticUpdates);
      if (!addOptimisticUpdates.has(optimisticBookId)) {
        addOptimisticUpdates.set(optimisticBookId, [...currentBookHighlights]);
      }
      
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [optimisticBookId]: [...currentBookHighlights, action.payload].sort((a, b) => {
            if (a.pageNumber && b.pageNumber) {
              return a.pageNumber - b.pageNumber;
            }
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          })
        },
        optimisticUpdates: addOptimisticUpdates,
        error: null
      };
    
    case 'OPTIMISTIC_UPDATE_HIGHLIGHT':
      const updateOptimisticHighlight = action.payload;
      const updateOptimisticBookId = updateOptimisticHighlight.bookId;
      const updateBookHighlights = state.highlights[updateOptimisticBookId] || [];
      
      // Store original state for potential rollback
      const updateOptimisticUpdates = new Map(state.optimisticUpdates);
      if (!updateOptimisticUpdates.has(updateOptimisticBookId)) {
        updateOptimisticUpdates.set(updateOptimisticBookId, [...updateBookHighlights]);
      }
      
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [updateOptimisticBookId]: updateBookHighlights.map(highlight =>
            highlight.id === updateOptimisticHighlight.id ? updateOptimisticHighlight : highlight
          )
        },
        optimisticUpdates: updateOptimisticUpdates,
        error: null
      };
    
    case 'OPTIMISTIC_DELETE_HIGHLIGHT':
      const { id: deleteOptimisticId, bookId: deleteOptimisticBookId } = action.payload;
      const deleteBookHighlights = state.highlights[deleteOptimisticBookId] || [];
      
      // Store original state for potential rollback
      const deleteOptimisticUpdates = new Map(state.optimisticUpdates);
      if (!deleteOptimisticUpdates.has(deleteOptimisticBookId)) {
        deleteOptimisticUpdates.set(deleteOptimisticBookId, [...deleteBookHighlights]);
      }
      
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [deleteOptimisticBookId]: deleteBookHighlights.filter(
            highlight => highlight.id !== deleteOptimisticId
          )
        },
        optimisticUpdates: deleteOptimisticUpdates,
        error: null
      };
    
    case 'REVERT_OPTIMISTIC_UPDATE':
      const { bookId: revertBookId, highlights: revertHighlights } = action.payload;
      const revertOptimisticUpdates = new Map(state.optimisticUpdates);
      revertOptimisticUpdates.delete(revertBookId);
      
      return {
        ...state,
        highlights: {
          ...state.highlights,
          [revertBookId]: revertHighlights
        },
        optimisticUpdates: revertOptimisticUpdates,
        loading: false
      };
    
    default:
      return state;
  }
}

// Create context
const HighlightsContext = createContext<HighlightsContextType | undefined>(undefined);

// Provider component
interface HighlightsProviderProps {
  children: ReactNode;
}

export function HighlightsProvider({ children }: HighlightsProviderProps) {
  const [state, dispatch] = useReducer(highlightsReducer, initialState);

  // Fetch highlights for a specific book
  const fetchHighlights = useCallback(async (bookId: number) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const highlights = await booksApi.getHighlights(bookId);
      dispatch({ type: 'SET_HIGHLIGHTS', payload: { bookId, highlights } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to fetch highlights';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  // Add new highlight to a book with optimistic updates
  const addHighlight = useCallback(async (bookId: number, data: HighlightFormData) => {
    // Get current highlights before optimistic update
    const currentHighlights = state.highlights[bookId] || [];
    
    // Create optimistic highlight with temporary ID
    const optimisticHighlight: Highlight = {
      id: Date.now(), // Temporary ID
      bookId,
      quoteText: data.quoteText,
      ...(data.pageNumber !== undefined && { pageNumber: data.pageNumber }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.personalNotes !== undefined && { personalNotes: data.personalNotes }),
      highlightDate: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    // Apply optimistic update immediately
    dispatch({ type: 'OPTIMISTIC_ADD_HIGHLIGHT', payload: optimisticHighlight });

    try {
      const newHighlight = await booksApi.addHighlight(bookId, data);
      dispatch({ type: 'ADD_HIGHLIGHT', payload: newHighlight });
    } catch (error) {
      // Revert optimistic update on error using the captured current highlights
      dispatch({ type: 'REVERT_OPTIMISTIC_UPDATE', payload: { bookId, highlights: currentHighlights } });
      
      const errorMessage = error instanceof ApiRequestError 
        ? error.message 
        : 'Failed to add highlight';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [state.highlights]);

  // Update existing highlight with optimistic updates
  const updateHighlight = useCallback(async (id: number, data: Partial<HighlightFormData>) => {
    // Find the highlight and its book
    let targetBookId: number | undefined;
    let originalHighlight: Highlight | undefined;
    
    for (const [bId, highlights] of Object.entries(state.highlights)) {
      const highlight = highlights.find(h => h.id === id);
      if (highlight) {
        targetBookId = parseInt(bId);
        originalHighlight = highlight;
        break;
      }
    }

    if (!targetBookId || !originalHighlight) {
      dispatch({ type: 'SET_ERROR', payload: 'Highlight not found' });
      return;
    }

    // Create optimistic update
    const optimisticHighlight: Highlight = {
      ...originalHighlight,
      ...(data.quoteText !== undefined && { quoteText: data.quoteText }),
      ...(data.pageNumber !== undefined && { pageNumber: data.pageNumber }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.personalNotes !== undefined && { personalNotes: data.personalNotes }),
      updatedAt: new Date().toISOString()
    };

    // Apply optimistic update immediately
    dispatch({ type: 'OPTIMISTIC_UPDATE_HIGHLIGHT', payload: optimisticHighlight });

    try {
      const updatedHighlight = await highlightsApi.update(id, data);
      dispatch({ type: 'UPDATE_HIGHLIGHT', payload: updatedHighlight });
    } catch (error) {
      // Revert optimistic update on error
      const originalHighlights = state.optimisticUpdates.get(targetBookId) || [];
      dispatch({ type: 'REVERT_OPTIMISTIC_UPDATE', payload: { bookId: targetBookId, highlights: originalHighlights } });
      
      const errorMessage = error instanceof ApiRequestError 
        ? error.message 
        : 'Failed to update highlight';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [state.highlights, state.optimisticUpdates]);

  // Delete highlight with optimistic updates
  const deleteHighlight = useCallback(async (id: number) => {
    // Find which book this highlight belongs to
    let bookId: number | undefined;
    for (const [bId, highlights] of Object.entries(state.highlights)) {
      if (highlights.some(h => h.id === id)) {
        bookId = parseInt(bId);
        break;
      }
    }
    
    if (!bookId) {
      dispatch({ type: 'SET_ERROR', payload: 'Highlight not found' });
      return;
    }

    // Apply optimistic delete immediately
    dispatch({ type: 'OPTIMISTIC_DELETE_HIGHLIGHT', payload: { id, bookId } });

    try {
      await highlightsApi.delete(id);
      dispatch({ type: 'DELETE_HIGHLIGHT', payload: { id, bookId } });
    } catch (error) {
      // Revert optimistic delete on error
      const originalHighlights = state.optimisticUpdates.get(bookId) || [];
      dispatch({ type: 'REVERT_OPTIMISTIC_UPDATE', payload: { bookId, highlights: originalHighlights } });
      
      const errorMessage = error instanceof ApiRequestError 
        ? error.message 
        : 'Failed to delete highlight';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, [state.highlights, state.optimisticUpdates]);

  // Bulk import highlights for a book
  const bulkImportHighlights = useCallback(async (bookId: number, highlightsData: HighlightFormData[]) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      const newHighlights: Highlight[] = [];
      
      // Add each highlight individually to get proper IDs from the backend
      for (const data of highlightsData) {
        const newHighlight = await booksApi.addHighlight(bookId, data);
        newHighlights.push(newHighlight);
      }
      
      dispatch({ type: 'ADD_BULK_HIGHLIGHTS', payload: { bookId, highlights: newHighlights } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import highlights';
      dispatch({ type: 'SET_ERROR', payload: errorMessage });
    }
  }, []);

  // Get highlights for a specific book
  const getHighlightsByBookId = useCallback((bookId: number): Highlight[] => {
    return state.highlights[bookId] || [];
  }, [state.highlights]);

  const contextValue: HighlightsContextType = {
    highlights: state.highlights,
    loading: state.loading,
    error: state.error,
    fetchHighlights,
    addHighlight,
    updateHighlight,
    deleteHighlight,
    bulkImportHighlights,
    getHighlightsByBookId,
  };

  return (
    <HighlightsContext.Provider value={contextValue}>
      {children}
    </HighlightsContext.Provider>
  );
}

// Custom hook to use the context
export function useHighlights(): HighlightsContextType {
  const context = useContext(HighlightsContext);
  if (context === undefined) {
    throw new Error('useHighlights must be used within a HighlightsProvider');
  }
  return context;
}