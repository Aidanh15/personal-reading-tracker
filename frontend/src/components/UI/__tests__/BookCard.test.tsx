import { fireEvent, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import BookCard from '../BookCard';
import { Book } from '../../../types';

const renderCard = (props: any) => render(<BrowserRouter><BookCard {...props} /></BrowserRouter>);

const mockBook: Book = {
  id: 1,
  title: 'Test Book Title',
  authors: ['Author One', 'Author Two'],
  position: 20,
  status: 'not_started',
  progressPercentage: 0,
  totalPages: 300,
  currentPage: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
};

describe('BookCard', () => {
  it('renders the title, authors, status, and detail link', () => {
    renderCard({ book: mockBook });

    expect(screen.getAllByText('Test Book Title')).not.toHaveLength(0);
    expect(screen.getByText('Author One · Author Two')).toBeInTheDocument();
    expect(screen.getByText('Queued')).toBeInTheDocument();
    expect(screen.getByRole('link')).toHaveAttribute('href', '/books/1');
  });

  it('shows the master-list position and milestone', () => {
    renderCard({ book: mockBook, showPosition: true });

    expect(screen.getByText('20')).toBeInTheDocument();
    expect(screen.getByText('Peak')).toBeInTheDocument();
    expect(screen.getByText('Master list · 020')).toBeInTheDocument();
  });

  it('does not render progress for a queued book', () => {
    renderCard({ book: mockBook });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('renders current progress for an active book', () => {
    renderCard({ book: { ...mockBook, status: 'in_progress', progressPercentage: 45 }, variant: 'detailed' });

    expect(screen.getByText('Reading')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '45');
    expect(screen.getByText('45% complete')).toBeInTheDocument();
  });

  it('renders the completed state', () => {
    renderCard({ book: { ...mockBook, status: 'completed', progressPercentage: 100 } });

    expect(screen.getByText('Read')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });

  it('uses the compact cover size for compact cards', () => {
    const { container } = renderCard({ book: mockBook, variant: 'compact' });
    expect(container.querySelector('.w-16.h-24')).toBeInTheDocument();
  });

  it('invokes a custom click handler without creating a link', () => {
    const onClick = vi.fn();
    const { container } = renderCard({ book: mockBook, onClick });

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    fireEvent.click(container.querySelector('.cursor-pointer')!);
    expect(onClick).toHaveBeenCalledWith(mockBook);
  });

  it('uses P instead of a fabricated number for the parallel track', () => {
    renderCard({ book: { ...mockBook, title: 'In Search of Lost Time', position: 85.5 }, showPosition: true });
    expect(screen.getByText('P')).toBeInTheDocument();
  });
});
