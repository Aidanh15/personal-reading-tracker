import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SearchBar from '../SearchBar';
// import { SearchFilters } from '../../../types';

// Mock localStorage
const mockLocalStorage = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: mockLocalStorage,
});

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Wrapper component for router context
const RouterWrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>{children}</BrowserRouter>
);

describe('SearchBar', () => {
  const mockOnSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockLocalStorage.getItem.mockReturnValue(null);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders with default placeholder', () => {
    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    expect(screen.getByPlaceholderText('Search books and highlights...')).toBeInTheDocument();
  });

  it('renders with custom placeholder', () => {
    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} placeholder="Custom placeholder" />
      </RouterWrapper>
    );

    expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
  });

  it('displays initial query value', () => {
    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} initialQuery="test query" />
      </RouterWrapper>
    );

    expect(screen.getByDisplayValue('test query')).toBeInTheDocument();
  });

  it('calls onSearch when typing with debounce', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    
    await user.type(input, 'test');
    
    // Should not call immediately
    expect(mockOnSearch).not.toHaveBeenCalled();
    
    // Fast-forward time to trigger debounce
    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(mockOnSearch).toHaveBeenCalledWith({
        query: 'test',
        sortBy: 'relevance',
        sortOrder: 'desc'
      });
    });
  });

  it('calls onSearch immediately when Enter is pressed', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    
    await user.type(input, 'test');
    await user.keyboard('{Enter}');

    expect(mockOnSearch).toHaveBeenCalledWith({
      query: 'test',
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  });

  it('clears search when clear button is clicked', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} initialQuery="test" />
      </RouterWrapper>
    );

    const clearButton = screen.getByRole('button');
    await user.click(clearButton);

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(mockOnSearch).toHaveBeenCalledWith({
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  });

  it('clears search when Escape is pressed', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} initialQuery="test" />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.keyboard('{Escape}');

    expect(screen.getByDisplayValue('')).toBeInTheDocument();
  });

  it('shows filters when showFilters is true and input is expanded', async () => {
    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} showFilters={true} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    await user.click(input);

    expect(screen.getByText('Status:')).toBeInTheDocument();
    expect(screen.getByText('Sort by:')).toBeInTheDocument();
    expect(screen.getByText('Order:')).toBeInTheDocument();
  });

  it('updates filters and triggers search', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} showFilters={true} initialQuery="test" />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    await user.click(input);

    const statusSelect = screen.getByDisplayValue('All');
    await user.selectOptions(statusSelect, 'in_progress');

    expect(mockOnSearch).toHaveBeenCalledWith({
      query: 'test',
      status: 'in_progress',
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  });

  it('loads and displays search history', () => {
    const mockHistory = JSON.stringify([
      { id: 'history-1', text: 'previous search', type: 'history', timestamp: Date.now() }
    ]);
    mockLocalStorage.getItem.mockReturnValue(mockHistory);

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    expect(screen.getByText('Recent Searches')).toBeInTheDocument();
    expect(screen.getByText('previous search')).toBeInTheDocument();
  });

  it('adds search to history when search is executed', async () => {
    vi.useFakeTimers();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'new search');
    await user.keyboard('{Enter}');

    expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
      'reading-tracker-search-history',
      expect.stringContaining('new search')
    );
  });

  it('clears search history when clear button is clicked', async () => {
    const user = userEvent.setup();
    const mockHistory = JSON.stringify([
      { id: 'history-1', text: 'previous search', type: 'history', timestamp: Date.now() }
    ]);
    mockLocalStorage.getItem.mockReturnValue(mockHistory);

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);

    expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('reading-tracker-search-history');
  });

  it('navigates to search page when not already there', async () => {
    // Mock window.location.pathname
    Object.defineProperty(window, 'location', {
      value: { pathname: '/' },
      writable: true,
    });

    const user = userEvent.setup();

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'test');
    await user.keyboard('{Enter}');

    expect(mockNavigate).toHaveBeenCalledWith('/search?q=test');
  });

  it('focuses input when autoFocus is true', () => {
    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} autoFocus={true} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    expect(input).toHaveFocus();
  });

  it('handles localStorage errors gracefully', () => {
    mockLocalStorage.getItem.mockImplementation(() => {
      throw new Error('localStorage error');
    });

    // Should not throw
    expect(() => {
      render(
        <RouterWrapper>
          <SearchBar onSearch={mockOnSearch} />
        </RouterWrapper>
      );
    }).not.toThrow();
  });

  it('handles suggestion click', async () => {
    const user = userEvent.setup();
    const mockHistory = JSON.stringify([
      { id: 'history-1', text: 'previous search', type: 'history', timestamp: Date.now() }
    ]);
    mockLocalStorage.getItem.mockReturnValue(mockHistory);

    render(
      <RouterWrapper>
        <SearchBar onSearch={mockOnSearch} />
      </RouterWrapper>
    );

    const input = screen.getByRole('textbox');
    fireEvent.focus(input);

    const suggestion = screen.getByText('previous search');
    await user.click(suggestion);

    expect(mockOnSearch).toHaveBeenCalledWith({
      query: 'previous search',
      sortBy: 'relevance',
      sortOrder: 'desc'
    });
  });
});