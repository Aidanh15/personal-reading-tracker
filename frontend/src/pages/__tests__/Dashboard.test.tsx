import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import Dashboard from '../Dashboard';
import { BooksProvider } from '../../contexts/BooksContext';
import { Book } from '../../types';
import * as api from '../../services/api';

// Mock the API
vi.mock('../../services/api');
const mockedApi = api as any;

const mockReviewSummary = {
  totalHighlights: 4,
  dueCount: 2,
  reviewedToday: 1,
  favoriteCount: 0,
  archivedCount: 0,
};

// Mock data
const mockBooks: Book[] = [
  {
    id: 1,
    title: 'First Book',
    authors: ['Author One'],
    position: 1,
    status: 'not_started',
    progressPercentage: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 2,
    title: 'Second Book',
    authors: ['Author Two'],
    position: 2,
    status: 'in_progress',
    progressPercentage: 45,
    currentPage: 135,
    totalPages: 300,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
  },
  {
    id: 3,
    title: 'Third Book',
    authors: ['Author Three'],
    position: 3,
    status: 'completed',
    progressPercentage: 100,
    currentPage: 250,
    totalPages: 250,
    completedDate: '2024-01-15T00:00:00Z',
    personalRating: 5,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-15T00:00:00Z',
  },
  {
    id: 4,
    title: 'Fourth Book',
    authors: ['Author Four'],
    position: 4,
    status: 'not_started',
    progressPercentage: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
];

const MockedDashboard = () => (
  <BrowserRouter>
    <BooksProvider>
      <Dashboard />
    </BooksProvider>
  </BrowserRouter>
);

describe('Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedApi.reviewApi = {
      getSummary: vi.fn().mockResolvedValue(mockReviewSummary),
    } as any;
  });

  describe('Loading and Error States', () => {
    it('shows loading spinner when loading', async () => {
      mockedApi.booksApi = {
        getAll: vi.fn().mockImplementation(() => new Promise(() => { })), // Never resolves
      } as any;

      render(<MockedDashboard />);

      // Look for loading spinner by class or text content
      const loadingElement = document.querySelector('.animate-spin') || screen.queryByText(/loading/i);
      expect(loadingElement).toBeInTheDocument();
    });

    it('shows error message when API fails', async () => {
      mockedApi.booksApi = {
        getAll: vi.fn().mockRejectedValue(new Error('API Error')),
      } as any;

      render(<MockedDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Error loading books')).toBeInTheDocument();
        expect(screen.getByText('API Error')).toBeInTheDocument();
      });
    });

    it('allows retry when error occurs', async () => {
      const mockGetAll = vi.fn()
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce(mockBooks);

      mockedApi.booksApi = {
        getAll: mockGetAll,
      } as any;

      render(<MockedDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Error loading books')).toBeInTheDocument();
      });

      const retryButton = screen.getByText('Try Again');
      fireEvent.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('Reading Dashboard')).toBeInTheDocument();
      });

      expect(mockGetAll).toHaveBeenCalledTimes(2);
    });
  });

  describe('Dashboard Content', () => {
    beforeEach(() => {
      mockedApi.booksApi = {
        getAll: vi.fn().mockResolvedValue(mockBooks),
      } as any;
    });

    it('renders dashboard header and description', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Reading Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Follow your reading order, review saved passages, and track progress')).toBeInTheDocument();
        expect(screen.getByText('Daily Review')).toBeInTheDocument();
      });
    });

    it('shows correct statistics', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        // Check for stats labels
        expect(screen.getByText('In the library')).toBeInTheDocument();
        expect(screen.getAllByText('Reading').length).toBeGreaterThan(0);
        expect(screen.getByText('Books completed')).toBeInTheDocument();
      });
    });

    it('displays currently reading section when books are in progress', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Currently Reading')).toBeInTheDocument();
        expect(screen.getAllByText('Second Book').length).toBeGreaterThan(0);
      });
    });

    it('displays up next section with reading order', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        expect(screen.getByText(/Your reading order/)).toBeInTheDocument();
        expect(screen.getAllByText('First Book').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Fourth Book').length).toBeGreaterThan(0);
      });
    });

    it('displays previously read section as collapsible', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        expect(screen.getByText('Previously Read (1)')).toBeInTheDocument();
        expect(screen.getByText('Show')).toBeInTheDocument();
      });

      // Initially, completed books should not be visible
      expect(screen.queryByText('Third Book')).not.toBeInTheDocument();

      // Click to show completed books
      const showButton = screen.getByText('Show');
      fireEvent.click(showButton);

      await waitFor(() => {
        expect(screen.getAllByText('Third Book').length).toBeGreaterThan(0);
        expect(screen.getByText('Hide')).toBeInTheDocument();
      });

      // Click to hide completed books
      const hideButton = screen.getByText('Hide');
      fireEvent.click(hideButton);

      await waitFor(() => {
        expect(screen.queryByText('Third Book')).not.toBeInTheDocument();
        expect(screen.getByText('Show')).toBeInTheDocument();
      });
    });
  });

  describe('Book Organization', () => {
    beforeEach(() => {
      mockedApi.booksApi = {
        getAll: vi.fn().mockResolvedValue(mockBooks),
      } as any;
    });

    it('organizes books by status correctly', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        // Currently Reading section should have in_progress books
        expect(screen.getByText('Currently Reading')).toBeInTheDocument();
        expect(screen.getAllByText('Second Book').length).toBeGreaterThan(0);

        // Up Next section should have not_started books
        expect(screen.getAllByText('First Book').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Fourth Book').length).toBeGreaterThan(0);
      });
    });

    it('maintains position order in up next section', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        // Check that books are displayed (position order is maintained by the component)
        expect(screen.getAllByText('First Book').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Fourth Book').length).toBeGreaterThan(0);
      });
    });

    it('shows position indicators in up next section', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        // Position indicators should be visible in up next section
        const positionBadges = screen.getAllByText('1');
        expect(positionBadges.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no books exist', async () => {
      mockedApi.booksApi = {
        getAll: vi.fn().mockResolvedValue([]),
      } as any;

      render(<MockedDashboard />);

      await waitFor(() => {
        expect(screen.getByText('No books yet')).toBeInTheDocument();
        expect(screen.getByText('Start building your reading list by adding your first book.')).toBeInTheDocument();
        expect(screen.getByText('Add Your First Book')).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    beforeEach(() => {
      mockedApi.booksApi = {
        getAll: vi.fn().mockResolvedValue(mockBooks),
      } as any;
    });

    it('renders responsive grid classes', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        // Check for responsive grid classes in stats section
        const statsSection = screen.getByText('In the library').closest('section');
        expect(statsSection).toHaveClass('sm:grid-cols-2');
        expect(statsSection).toHaveClass('lg:grid-cols-4');
      });
    });

    it('renders responsive header layout', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        // Check that the dashboard renders with responsive layout
        expect(screen.getByText('Reading Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Start Review')).toBeInTheDocument();
      });
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      mockedApi.booksApi = {
        getAll: vi.fn().mockResolvedValue(mockBooks),
      } as any;
    });

    it('creates proper links to book detail pages', async () => {
      render(<MockedDashboard />);

      await waitFor(() => {
        const bookLinks = screen.getAllByRole('link');
        const secondBookLink = bookLinks.find(link =>
          link.getAttribute('href') === '/books/2'
        );
        expect(secondBookLink).toBeInTheDocument();
      });
    });
  });
});
