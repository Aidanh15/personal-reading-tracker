import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import Toast, { ToastType } from '../Toast';

const mockOnClose = vi.fn();

const defaultProps = {
  id: 'test-toast',
  type: 'info' as ToastType,
  title: 'Test Title',
  onClose: mockOnClose,
};

describe('Toast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('renders toast with title', () => {
    render(<Toast {...defaultProps} />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });

  it('renders toast with message when provided', () => {
    render(<Toast {...defaultProps} message="Test message" />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('renders success toast with correct styling', () => {
    const { container } = render(<Toast {...defaultProps} type="success" />);

    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('bg-green-50', 'border-green-200');
  });

  it('renders error toast with correct styling', () => {
    const { container } = render(<Toast {...defaultProps} type="error" />);

    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('bg-red-50', 'border-red-200');
  });

  it('renders warning toast with correct styling', () => {
    const { container } = render(<Toast {...defaultProps} type="warning" />);

    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('bg-yellow-50', 'border-yellow-200');
  });

  it('renders info toast with correct styling', () => {
    const { container } = render(<Toast {...defaultProps} type="info" />);

    const toast = container.firstChild as HTMLElement;
    expect(toast).toHaveClass('bg-blue-50', 'border-blue-200');
  });

  it('calls onClose when close button is clicked', () => {
    render(<Toast {...defaultProps} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    // Wait for animation
    vi.advanceTimersByTime(300);

    expect(mockOnClose).toHaveBeenCalledWith('test-toast');
  });

  it('auto-closes after specified duration', async () => {
    render(<Toast {...defaultProps} duration={1000} />);

    expect(mockOnClose).not.toHaveBeenCalled();

    // Fast-forward time
    vi.advanceTimersByTime(1300); // 1000ms duration + 300ms animation

    expect(mockOnClose).toHaveBeenCalledWith('test-toast');
  });

  it('does not auto-close when duration is 0', () => {
    render(<Toast {...defaultProps} duration={0} />);

    vi.advanceTimersByTime(10000);

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('shows entrance animation', async () => {
    const { container } = render(<Toast {...defaultProps} />);

    const toast = container.firstChild as HTMLElement;

    // Initially should have translate-x-full (off-screen)
    expect(toast).toHaveClass('translate-x-full', 'opacity-0');

    // After animation trigger
    vi.advanceTimersByTime(20);

    await waitFor(() => {
      expect(toast).toHaveClass('translate-x-0', 'opacity-100');
    });
  });

  it('shows exit animation when closing', async () => {
    const { container } = render(<Toast {...defaultProps} />);

    const toast = container.firstChild as HTMLElement;
    const closeButton = screen.getByRole('button');

    // Wait for entrance animation
    vi.advanceTimersByTime(20);
    await waitFor(() => {
      expect(toast).toHaveClass('translate-x-0', 'opacity-100');
    });

    // Click close
    fireEvent.click(closeButton);

    // Should show exit animation
    await waitFor(() => {
      expect(toast).toHaveClass('translate-x-full', 'opacity-0');
    });
  });

  it('has proper accessibility attributes', () => {
    render(<Toast {...defaultProps} />);

    // Should have screen reader text
    expect(screen.getByText('Close')).toHaveClass('sr-only');
  });
});