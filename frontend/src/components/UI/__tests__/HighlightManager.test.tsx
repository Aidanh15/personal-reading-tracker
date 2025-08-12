import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import HighlightManager from '../HighlightManager';
import { Highlight } from '../../../types';

// Mock data
const mockHighlights: Highlight[] = [
  {
    id: 1,
    bookId: 1,
    quoteText: 'This is a test highlight from page 10',
    pageNumber: 10,
    location: 'Chapter 1',
    personalNotes: 'This is a great insight',
    highlightDate: '2024-01-01T00:00:00Z',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    bookId: 1,
    quoteText: 'Another important quote from page 25',
    pageNumber: 25,
    location: 'Chapter 2',
    personalNotes: 'Key concept to remember',
    highlightDate: '2024-01-02T00:00:00Z',
    createdAt: '2024-01-02T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z'
  }
];

// Mock functions
const mockOnAddHighlight = vi.fn();
const mockOnUpdateHighlight = vi.fn();
const mockOnDeleteHighlight = vi.fn();
const mockOnBulkImport = vi.fn();

// Default props
const defaultProps = {
  highlights: mockHighlights,
  loading: false,
  onAddHighlight: mockOnAddHighlight,
  onUpdateHighlight: mockOnUpdateHighlight,
  onDeleteHighlight: mockOnDeleteHighlight,
  onBulkImport: mockOnBulkImport
};

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: vi.fn(() => true)
});

describe('HighlightManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders highlights list correctly', () => {
      render(<HighlightManager {...defaultProps} />);
      
      expect(screen.getByText('"This is a test highlight from page 10"')).toBeInTheDocument();
      expect(screen.getByText('"Another important quote from page 25"')).toBeInTheDocument();
    });

    it('displays highlight metadata correctly', () => {
      render(<HighlightManager {...defaultProps} />);
      
      expect(screen.getByText('Page 10')).toBeInTheDocument();
      expect(screen.getByText('Chapter 1')).toBeInTheDocument();
      expect(screen.getByText('This is a great insight')).toBeInTheDocument();
    });

    it('shows correct highlights count', () => {
      render(<HighlightManager {...defaultProps} />);
      
      expect(screen.getByText('2 highlights total')).toBeInTheDocument();
    });

    it('renders empty state when no highlights', () => {
      render(<HighlightManager {...defaultProps} highlights={[]} />);
      
      expect(screen.getByText('No highlights yet')).toBeInTheDocument();
      expect(screen.getByText('Add First Highlight')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('has search input', () => {
      render(<HighlightManager {...defaultProps} />);
      
      expect(screen.getByPlaceholderText('Search highlights...')).toBeInTheDocument();
    });

    it('filters highlights by quote text', async () => {
      const user = userEvent.setup();
      render(<HighlightManager {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText('Search highlights...');
      await user.type(searchInput, 'test highlight');
      
      expect(screen.getByText('"This is a test highlight from page 10"')).toBeInTheDocument();
      expect(screen.queryByText('Another important quote from page 25')).not.toBeInTheDocument();
    });
  });

  describe('Add Highlight Functionality', () => {
    it('opens add highlight modal when clicking Add Highlight button', async () => {
      const user = userEvent.setup();
      render(<HighlightManager {...defaultProps} />);
      
      // Click the main Add Highlight button (not in modal)
      const addButtons = screen.getAllByText('Add Highlight');
      expect(addButtons[0]).toBeDefined();
      await user.click(addButtons[0]!);
      
      // Check for modal heading
      await waitFor(() => {
        expect(screen.getByRole('heading', { level: 2 })).toBeInTheDocument();
      });
    });

    it('submits new highlight with correct data', async () => {
      const user = userEvent.setup();
      mockOnAddHighlight.mockResolvedValue(undefined);
      render(<HighlightManager {...defaultProps} />);
      
      // Click the main Add Highlight button
      const addButtons = screen.getAllByText('Add Highlight');
      expect(addButtons[0]).toBeDefined();
      await user.click(addButtons[0]!);
      
      // Wait for modal to open and find the textarea
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter the highlighted text...')).toBeInTheDocument();
      });
      
      const quoteTextarea = screen.getByPlaceholderText('Enter the highlighted text...');
      await user.type(quoteTextarea, 'New test quote');
      
      // Submit the form - get the submit button (should be the second "Add Highlight" button)
      const submitButtons = screen.getAllByText('Add Highlight');
      const submitButton = submitButtons[submitButtons.length - 1];
      expect(submitButton).toBeDefined();
      await user.click(submitButton!);
      
      expect(mockOnAddHighlight).toHaveBeenCalledWith({
        quoteText: 'New test quote',
        pageNumber: undefined,
        location: '',
        personalNotes: ''
      });
    });
  });

  describe('Delete Highlight Functionality', () => {
    it('shows confirmation dialog when deleting highlight', async () => {
      const user = userEvent.setup();
      render(<HighlightManager {...defaultProps} />);
      
      const deleteButtons = screen.getAllByText('×');
      expect(deleteButtons[0]).toBeDefined();
      await user.click(deleteButtons[0]!);
      
      expect(window.confirm).toHaveBeenCalledWith('Are you sure you want to delete this highlight?');
    });

    it('calls delete function when confirmed', async () => {
      const user = userEvent.setup();
      render(<HighlightManager {...defaultProps} />);
      
      const deleteButtons = screen.getAllByText('×');
      expect(deleteButtons[0]).toBeDefined();
      await user.click(deleteButtons[0]!);
      
      // The first delete button corresponds to the first highlight in the sorted list
      // By default, highlights are sorted by date desc, so the second highlight (id: 2) comes first
      expect(mockOnDeleteHighlight).toHaveBeenCalledWith(2);
    });
  });

  describe('Bulk Import Functionality', () => {
    it('shows import button when onBulkImport is provided', () => {
      render(<HighlightManager {...defaultProps} />);
      
      expect(screen.getByText('Import')).toBeInTheDocument();
    });

    it('hides import button when onBulkImport is not provided', () => {
      const { onBulkImport, ...propsWithoutBulkImport } = defaultProps;
      render(<HighlightManager {...propsWithoutBulkImport} />);
      
      expect(screen.queryByText('Import')).not.toBeInTheDocument();
    });

    it('opens import modal when clicking Import button', async () => {
      const user = userEvent.setup();
      render(<HighlightManager {...defaultProps} />);
      
      await user.click(screen.getByText('Import'));
      
      expect(screen.getByText('Import Kindle Highlights')).toBeInTheDocument();
    });

    it('parses Kindle highlights text correctly', async () => {
      const user = userEvent.setup();
      render(<HighlightManager {...defaultProps} />);
      
      await user.click(screen.getByText('Import'));
      
      const kindleText = `This is a test highlight from a Kindle book.
Location 123

Another highlight with page information.
Page 45`;
      
      const textarea = screen.getByPlaceholderText('Paste your Kindle highlights here...');
      await user.type(textarea, kindleText);
      
      expect(screen.getByText('Preview (2 highlights found)')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('handles add highlight errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOnAddHighlight.mockRejectedValue(new Error('Network error'));
      
      render(<HighlightManager {...defaultProps} />);
      
      // Click the main Add Highlight button
      const addButtons = screen.getAllByText('Add Highlight');
      expect(addButtons[0]).toBeDefined();
      await user.click(addButtons[0]!);
      
      // Wait for modal to open
      await waitFor(() => {
        expect(screen.getByPlaceholderText('Enter the highlighted text...')).toBeInTheDocument();
      });
      
      const quoteTextarea = screen.getByPlaceholderText('Enter the highlighted text...');
      await user.type(quoteTextarea, 'Test quote');
      
      // Click the submit button (last "Add Highlight" button)
      const submitButtons = screen.getAllByText('Add Highlight');
      const submitButton = submitButtons[submitButtons.length - 1];
      expect(submitButton).toBeDefined();
      await user.click(submitButton!);
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to add highlight:', expect.any(Error));
      });
      
      consoleError.mockRestore();
    });

    it('handles delete highlight errors gracefully', async () => {
      const user = userEvent.setup();
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOnDeleteHighlight.mockRejectedValue(new Error('Network error'));
      
      render(<HighlightManager {...defaultProps} />);
      
      const deleteButtons = screen.getAllByText('×');
      expect(deleteButtons[0]).toBeDefined();
      await user.click(deleteButtons[0]!);
      
      await waitFor(() => {
        expect(consoleError).toHaveBeenCalledWith('Failed to delete highlight:', expect.any(Error));
      });
      
      consoleError.mockRestore();
    });
  });
});