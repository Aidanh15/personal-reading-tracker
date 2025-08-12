import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import BookCard from '../BookCard';
import { Book } from '../../../types';

// Mock the react-router-dom Link component
const MockedBookCard = ({ children, ...props }: any) => (
  <BrowserRouter>
    <BookCard {...props} />
  </BrowserRouter>
);

const mockBook: Book = {
  id: 1,
  title: 'Test Book Title',
  authors: ['Author One', 'Author Two'],
  position: 1,
  status: 'not_started',
  progressPercentage: 0,
  totalPages: 300,
  currentPage: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

const inProgressBook: Book = {
  ...mockBook,
  id: 2,
  status: 'in_progress',
  progressPercentage: 45,
  currentPage: 135,
};

const completedBook: Book = {
  ...mockBook,
  id: 3,
  status: 'completed',
  progressPercentage: 100,
  currentPage: 300,
  completedDate: '2024-01-15T00:00:00Z',
  personalRating: 4,
};

describe('BookCard', () => {
  describe('Basic rendering', () => {
    it('renders book title and authors', () => {
      render(<MockedBookCard book={mockBook} />);
      
      expect(screen.getByText('Test Book Title')).toBeInTheDocument();
      expect(screen.getByText('Author One, Author Two')).toBeInTheDocument();
    });

    it('renders as a link by default', () => {
      render(<MockedBookCard book={mockBook} />);
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/books/1');
    });

    it('renders with custom onClick handler instead of link', () => {
      const mockOnClick = vi.fn();
      render(<MockedBookCard book={mockBook} onClick={mockOnClick} />);
      
      // Should not render as a link when onClick is provided
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
      
      const card = screen.getByText('Test Book Title').closest('.card');
      fireEvent.click(card!);
      expect(mockOnClick).toHaveBeenCalledWith(mockBook);
    });
  });

  describe('Status indicators', () => {
    it('shows correct status for not started book', () => {
      render(<MockedBookCard book={mockBook} />);
      
      expect(screen.getByText('Not Started')).toBeInTheDocument();
      // Check for clock icon by looking for SVG with specific class
      const clockIcon = document.querySelector('svg.text-gray-400');
      expect(clockIcon).toBeInTheDocument();
    });

    it('shows correct status for in progress book', () => {
      render(<MockedBookCard book={inProgressBook} />);
      
      expect(screen.getByText('Reading')).toBeInTheDocument();
      // Check for book icon by looking for SVG with specific class
      const bookIcon = document.querySelector('svg.text-blue-600');
      expect(bookIcon).toBeInTheDocument();
    });

    it('shows correct status for completed book', () => {
      render(<MockedBookCard book={completedBook} />);
      
      expect(screen.getByText('Completed')).toBeInTheDocument();
      // Check for check icon by looking for SVG with specific class
      const checkIcon = document.querySelector('svg.text-green-600');
      expect(checkIcon).toBeInTheDocument();
    });
  });

  describe('Progress display', () => {
    it('does not show progress bar for not started books', () => {
      render(<MockedBookCard book={mockBook} />);
      
      // Progress bar should not be visible for not started books
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('shows progress bar for in progress books', () => {
      render(<MockedBookCard book={inProgressBook} />);
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows progress bar for completed books', () => {
      render(<MockedBookCard book={completedBook} />);
      
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('shows page information in detailed variant', () => {
      render(<MockedBookCard book={inProgressBook} variant="detailed" />);
      
      expect(screen.getByText('Page 135 of 300')).toBeInTheDocument();
    });

    it('shows completion date in detailed variant for completed books', () => {
      render(<MockedBookCard book={completedBook} variant="detailed" />);
      
      expect(screen.getByText(/Finished/)).toBeInTheDocument();
    });
  });

  describe('Position display', () => {
    it('shows position when showPosition is true', () => {
      render(<MockedBookCard book={mockBook} showPosition={true} />);
      
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('does not show position when showPosition is false', () => {
      render(<MockedBookCard book={mockBook} showPosition={false} />);
      
      // Position should not be visible
      const positionElements = screen.queryAllByText('1');
      // Filter out any elements that might contain '1' as part of other content
      const positionBadges = positionElements.filter(el => 
        el.textContent === '1' && el.classList.contains('rounded-full')
      );
      expect(positionBadges).toHaveLength(0);
    });
  });

  describe('Rating display', () => {
    it('shows star rating for completed books in detailed variant', () => {
      render(<MockedBookCard book={completedBook} variant="detailed" />);
      
      // Should show 5 stars total - check for star SVGs
      const starContainer = document.querySelector('.flex.items-center.space-x-1');
      expect(starContainer).toBeInTheDocument();
      
      const stars = starContainer?.querySelectorAll('svg');
      expect(stars).toHaveLength(5);
    });

    it('does not show rating for non-completed books', () => {
      render(<MockedBookCard book={inProgressBook} variant="detailed" />);
      
      const stars = screen.queryAllByRole('img', { hidden: true });
      expect(stars).toHaveLength(0);
    });

    it('does not show rating in non-detailed variants', () => {
      render(<MockedBookCard book={completedBook} variant="default" />);
      
      const stars = screen.queryAllByRole('img', { hidden: true });
      expect(stars).toHaveLength(0);
    });
  });

  describe('Variants', () => {
    it('applies compact styling for compact variant', () => {
      render(<MockedBookCard book={mockBook} variant="compact" />);
      
      const title = screen.getByText('Test Book Title');
      expect(title).toHaveClass('text-sm', 'line-clamp-1');
    });

    it('applies default styling for default variant', () => {
      render(<MockedBookCard book={mockBook} variant="default" />);
      
      const title = screen.getByText('Test Book Title');
      expect(title).toHaveClass('text-base', 'line-clamp-2');
    });

    it('shows additional details in detailed variant', () => {
      render(<MockedBookCard book={inProgressBook} variant="detailed" />);
      
      // Should show percentage in detailed variant
      expect(screen.getByText('45%')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper link accessibility', () => {
      render(<MockedBookCard book={mockBook} />);
      
      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', '/books/1');
    });

    it('has proper button accessibility with onClick', () => {
      const mockOnClick = vi.fn();
      render(<MockedBookCard book={mockBook} onClick={mockOnClick} />);
      
      const card = screen.getByText('Test Book Title').closest('.card');
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass('cursor-pointer');
    });
  });
});