import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import SearchResults from '../SearchResults';
import { SearchResult, Book, HighlightWithBook } from '../../../types';

// Wrapper component for router context
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('SearchResults', () => {
  const mockBooks: Book[] = [
    {
      id: 1,
      title: 'Test Book One',
      authors: ['Author One'],
      position: 1,
      status: 'in_progress',
      progressPercentage: 50,
      totalPages: 200,
      currentPage: 100,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    },
    {
      id: 2,
      title: 'Another Book',
      authors: ['Author Two', 'Author Three'],
      position: 2,
      status: 'completed',
      progressPercentage: 100,
      totalPages: 300,
      currentPage: 300,
      completedDate: '2024-01-15T00:00:00Z',
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-15T00:00:00Z'
    }
  ];

  const mockHighlights: HighlightWithBook[] = [
    {
      id: 1,
      bookId: 1,
      quoteText: 'This is a test highlight from the book',
      pageNumber: 50,
      personalNotes: 'Important note about this highlight',
      highlightDate: '2024-01-10T00:00:00Z',
      createdAt: '2024-01-10T00:00:00Z',
      updatedAt: '2024-01-10T00:00:00Z',
      bookTitle: 'Test Book One',
      bookAuthors: ['Author One']
    },
    {
      id: 2,
      bookId: 2,
      quoteText: 'Another important quote from another book',
      pageNumber: 150,
      highlightDate: '2024-01-12T00:00:00Z',
      createdAt: '2024-01-12T00:00:00Z',
      updatedAt: '2024-01-12T00:00:00Z',
      bookTitle: 'Another Book',
      bookAuthors: ['Author Two', 'Author Three']
    }
  ];

  const mockSearchResult: SearchResult = {
    books: mockBooks,
    highlights: mockHighlights,
    totalResults: 4,
    query: 'test',
    filters: {
      sortBy: 'relevance',
      sortOrder: 'desc'
    }
  };

  it('shows loading spinner when loading', () => {
    render(
      <RouterWrapper>
        <SearchResults results={null} loading={true} error={null} query="" />
      </RouterWrapper>
    );

    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows error message when there is an error', () => {
    render(
      <RouterWrapper>
        <SearchResults results={null} loading={false} error="Search failed" query="test" />
      </RouterWrapper>
    );

    expect(screen.getByText('Search Error')).toBeInTheDocument();
    expect(screen.getByText('Search failed')).toBeInTheDocument();
  });

  it('shows start searching message when no query and no results', () => {
    render(
      <RouterWrapper>
        <SearchResults results={null} loading={false} error={null} query="" />
      </RouterWrapper>
    );

    expect(screen.getByText('Start searching')).toBeInTheDocument();
    expect(screen.getByText('Enter a search term to find books and highlights')).toBeInTheDocument();
  });

  it('shows no results message when query exists but no results', () => {
    const emptyResults: SearchResult = {
      books: [],
      highlights: [],
      totalResults: 0,
      query: 'nonexistent',
      filters: {}
    };

    render(
      <RouterWrapper>
        <SearchResults results={emptyResults} loading={false} error={null} query="nonexistent" />
      </RouterWrapper>
    );

    expect(screen.getByText('No results found')).toBeInTheDocument();
    expect(screen.getByText('No books or highlights match your search for "nonexistent"')).toBeInTheDocument();
  });

  it('displays search results with correct counts', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    expect(screen.getByText('Search Results for "test"')).toBeInTheDocument();
    expect(screen.getByText('4 results found')).toBeInTheDocument();
    expect(screen.getByText('Books (2)')).toBeInTheDocument();
    expect(screen.getByText('Highlights (2)')).toBeInTheDocument();
  });

  it('highlights search terms in book titles and authors', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    // Check for highlighted text in book title
    const highlightedElements = screen.getAllByText('test');
    expect(highlightedElements.length).toBeGreaterThan(0);
    
    // Check that the highlight has the correct styling
    const firstHighlight = highlightedElements[0];
    expect(firstHighlight).toBeDefined();
    expect(firstHighlight!.tagName).toBe('MARK');
    expect(firstHighlight).toHaveClass('bg-yellow-200', 'text-yellow-900');
  });

  it('highlights search terms in highlight quotes and notes', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    // Check for highlighted text in highlight quote
    expect(screen.getByText('"This is a ')).toBeInTheDocument();
    const highlightedText = screen.getByText('test');
    expect(highlightedText.tagName).toBe('MARK');
  });

  it('shows book status badges correctly', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    expect(screen.getByText('in progress')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('50% complete')).toBeInTheDocument();
  });

  it('shows highlight page numbers when available', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    expect(screen.getByText('Page 50')).toBeInTheDocument();
    expect(screen.getByText('Page 150')).toBeInTheDocument();
  });

  it('shows personal notes in highlights when available', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    expect(screen.getByText('Note:')).toBeInTheDocument();
    expect(screen.getByText('Important note about this highlight')).toBeInTheDocument();
  });

  it('toggles filter visibility when filter button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    const filterButton = screen.getByText('Filters');
    await user.click(filterButton);

    expect(screen.getByText('Show:')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Books')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();
  });

  it('filters results when filter buttons are clicked', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    // Open filters
    const filterButton = screen.getByText('Filters');
    await user.click(filterButton);

    // Click Books filter
    const booksFilter = screen.getByText('Books');
    await user.click(booksFilter);

    // Should only show books section
    expect(screen.getByText('Books (2)')).toBeInTheDocument();
    expect(screen.queryByText('Highlights (2)')).not.toBeInTheDocument();
  });

  it('shows correct result counts in filter buttons', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    // Open filters
    const filterButton = screen.getByText('Filters');
    await user.click(filterButton);

    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('(4)')).toBeInTheDocument(); // Total count
    expect(screen.getByText('(2)')).toBeInTheDocument(); // Books count
    expect(screen.getByText('(2)')).toBeInTheDocument(); // Highlights count
  });

  it('creates correct links to book detail pages', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="test" />
      </RouterWrapper>
    );

    const bookLinks = screen.getAllByRole('link');
    expect(bookLinks[0]).toHaveAttribute('href', '/books/1');
    expect(bookLinks[1]).toHaveAttribute('href', '/books/2');
  });

  it('handles empty search query gracefully', () => {
    const resultsWithoutQuery: SearchResult = {
      ...mockSearchResult,
      query: ''
    };

    render(
      <RouterWrapper>
        <SearchResults results={resultsWithoutQuery} loading={false} error={null} query="" />
      </RouterWrapper>
    );

    // Should not highlight anything when query is empty
    const markElements = document.querySelectorAll('mark');
    expect(markElements.length).toBe(0);
  });

  it('escapes special regex characters in search query', () => {
    const specialCharQuery = 'test.query+with*special[chars]';
    
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query={specialCharQuery} />
      </RouterWrapper>
    );

    // Should not throw error and should render normally
    expect(screen.getByText('Search Results')).toBeInTheDocument();
  });

  it('shows multiple authors correctly', () => {
    render(
      <RouterWrapper>
        <SearchResults results={mockSearchResult} loading={false} error={null} query="author" />
      </RouterWrapper>
    );

    expect(screen.getByText('by Author One')).toBeInTheDocument();
    expect(screen.getByText('by Author Two, Author Three')).toBeInTheDocument();
  });
});