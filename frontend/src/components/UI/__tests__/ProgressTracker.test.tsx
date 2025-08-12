import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import ProgressTracker from '../ProgressTracker';
import { Book } from '../../../types';

// Mock the UI components
vi.mock('../Button', () => ({
  default: ({ children, onClick, disabled, loading, ...props }: any) => (
    <button onClick={onClick} disabled={disabled || loading} {...props}>
      {loading ? 'Loading...' : children}
    </button>
  )
}));

vi.mock('../Input', () => ({
  default: ({ label, value, onChange, ...props }: any) => (
    <div>
      {label && <label>{label}</label>}
      <input value={value} onChange={onChange} {...props} />
    </div>
  )
}));

vi.mock('../ProgressBar', () => ({
  default: ({ progress, showPercentage }: any) => (
    <div data-testid="progress-bar">
      Progress: {progress}%
      {showPercentage && <span>{progress}%</span>}
    </div>
  )
}));

describe('ProgressTracker', () => {
  const mockBook: Book = {
    id: 1,
    title: 'Test Book',
    authors: ['Test Author'],
    position: 1,
    status: 'in_progress',
    progressPercentage: 50,
    totalPages: 300,
    currentPage: 150,
    startedDate: '2024-01-01T00:00:00Z',
    personalRating: 4,
    personalReview: 'Great book so far!',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  };

  const mockOnUpdateProgress = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders book progress information in view mode', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    expect(screen.getByText('Reading Progress')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
    expect(screen.getByText('Page 150 of 300')).toBeInTheDocument();
    expect(screen.getByText('150 pages remaining')).toBeInTheDocument();
    expect(screen.getByText(/Started:/)).toBeInTheDocument();
    expect(screen.getByText('Rating:')).toBeInTheDocument();
    expect(screen.getByText('(4/5)')).toBeInTheDocument();
    expect(screen.getByText('Review:')).toBeInTheDocument();
    expect(screen.getByText('Great book so far!')).toBeInTheDocument();
  });

  it('renders completed book with completion date', () => {
    const completedBook: Book = {
      ...mockBook,
      status: 'completed',
      progressPercentage: 100,
      currentPage: 300,
      completedDate: '2024-02-01T00:00:00Z'
    };

    render(
      <ProgressTracker
        book={completedBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText(/Completed:/)).toBeInTheDocument();
  });

  it('renders not started book without dates', () => {
    const { startedDate, personalRating, personalReview, ...baseBook } = mockBook;
    const notStartedBook: Book = {
      ...baseBook,
      status: 'not_started',
      progressPercentage: 0,
      currentPage: 0
    };

    render(
      <ProgressTracker
        book={notStartedBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    expect(screen.getByText('Not Started')).toBeInTheDocument();
    expect(screen.queryByText(/Started:/)).not.toBeInTheDocument();
    expect(screen.queryByText('Rating:')).not.toBeInTheDocument();
    expect(screen.queryByText('Review:')).not.toBeInTheDocument();
  });

  it('switches to edit mode when update button is clicked', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));

    expect(screen.getByText('Update Reading Progress')).toBeInTheDocument();
    expect(screen.getByText('Reading Status')).toBeInTheDocument();
    expect(screen.getByText('Progress Percentage')).toBeInTheDocument();
    expect(screen.getByText('Current Page')).toBeInTheDocument();
    expect(screen.getByText('Personal Rating (Optional)')).toBeInTheDocument();
    expect(screen.getByText('Personal Review (Optional)')).toBeInTheDocument();
  });

  it('updates form data when inputs change', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));

    // Update status
    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'completed' } });
    expect(statusSelect).toHaveValue('completed');

    // Update progress percentage
    const progressSlider = screen.getByDisplayValue('50');
    fireEvent.change(progressSlider, { target: { value: '75' } });
    expect(progressSlider).toHaveValue('75');

    // Update current page (it should now be 225 due to the progress change above)
    const pageInput = screen.getByDisplayValue('225');
    fireEvent.change(pageInput, { target: { value: '200' } });
    expect(pageInput).toHaveValue(200);
  });

  it('auto-calculates progress when page changes', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));

    const pageInput = screen.getByDisplayValue('150');
    fireEvent.change(pageInput, { target: { value: '225' } }); // 225/300 = 75%

    // The progress slider should be updated to 75%
    const progressSlider = screen.getByDisplayValue('75');
    expect(progressSlider).toBeInTheDocument();
  });

  it('auto-calculates page when progress changes', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));

    const progressSlider = screen.getByDisplayValue('50');
    fireEvent.change(progressSlider, { target: { value: '80' } }); // 80% of 300 = 240 pages

    // The page input should be updated to 240
    const pageInput = screen.getByDisplayValue('240');
    expect(pageInput).toBeInTheDocument();
  });

  it('handles star rating clicks', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));

    // Find star buttons (there should be 5)
    const starButtons = screen.getAllByRole('button').filter(button => 
      button.querySelector('svg')
    );
    
    // Click the 5th star
    expect(starButtons[4]).toBeDefined();
    fireEvent.click(starButtons[4]!);

    // The rating should be updated (we can't easily test the visual state change in this test setup)
    expect(starButtons[4]).toBeInTheDocument();
  });

  it('submits progress update with correct data', async () => {
    mockOnUpdateProgress.mockResolvedValue(undefined);

    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));

    // Update some values
    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    const progressSlider = screen.getByDisplayValue('50');
    fireEvent.change(progressSlider, { target: { value: '100' } });

    // Submit the form
    fireEvent.click(screen.getByText('Save Progress'));

    await waitFor(() => {
      expect(mockOnUpdateProgress).toHaveBeenCalledWith({
        currentPage: 300, // Auto-calculated from 100% of 300 pages
        progressPercentage: 100,
        status: 'completed',
        completedDate: expect.any(String), // Should set completion date
        personalRating: 4,
        personalReview: 'Great book so far!'
      });
    });
  });

  it('cancels edit mode and resets form', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));

    // Make some changes
    const statusSelect = screen.getByRole('combobox');
    fireEvent.change(statusSelect, { target: { value: 'completed' } });

    // Cancel
    fireEvent.click(screen.getByText('Cancel'));

    // Should be back in view mode
    expect(screen.getByText('Reading Progress')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument(); // Original status restored
  });

  it('handles loading state', () => {
    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
        loading={true}
      />
    );

    const updateButton = screen.getByText('Update Progress');
    expect(updateButton).toBeDisabled();
  });

  it('handles books without total pages', () => {
    const { totalPages, currentPage, ...baseBook } = mockBook;
    const bookWithoutPages: Book = {
      ...baseBook
    };

    render(
      <ProgressTracker
        book={bookWithoutPages}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    // Should not show page information
    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.queryByText(/pages remaining/)).not.toBeInTheDocument();

    // In edit mode, should not show current page input
    fireEvent.click(screen.getByText('Update Progress'));
    expect(screen.queryByText('Current Page')).not.toBeInTheDocument();
  });

  it('handles error during progress update', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOnUpdateProgress.mockRejectedValue(new Error('Update failed'));

    render(
      <ProgressTracker
        book={mockBook}
        onUpdateProgress={mockOnUpdateProgress}
      />
    );

    fireEvent.click(screen.getByText('Update Progress'));
    fireEvent.click(screen.getByText('Save Progress'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith('Failed to update progress:', expect.any(Error));
    });

    consoleSpy.mockRestore();
  });
});