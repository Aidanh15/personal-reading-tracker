import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import App from '../App';

// Mock the contexts to avoid API calls in tests
vi.mock('../contexts/BooksContext', () => ({
  BooksProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useBooks: () => ({
    books: [],
    loading: false,
    error: null,
    fetchBooks: vi.fn(),
    getBookById: vi.fn(),
    updateBookProgress: vi.fn(),
    addBook: vi.fn(),
    deleteBook: vi.fn(),
    updateBookPositions: vi.fn(),
  }),
}));

vi.mock('../contexts/HighlightsContext', () => ({
  HighlightsProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  useHighlights: () => ({
    highlights: {},
    loading: false,
    error: null,
    fetchHighlights: vi.fn(),
    addHighlight: vi.fn(),
    updateHighlight: vi.fn(),
    deleteHighlight: vi.fn(),
    getHighlightsByBookId: vi.fn(() => []),
  }),
}));

describe('App', () => {
  it('renders without crashing', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Reading Tracker')).toBeInTheDocument();
  });

  it('renders navigation links', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Search')).toBeInTheDocument();
  });

  it('renders dashboard by default', () => {
    render(
      <BrowserRouter>
        <App />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Reading Dashboard')).toBeInTheDocument();
  });
});