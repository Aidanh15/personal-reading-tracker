import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Modal from '../Modal';

// Mock the document.body.style to avoid issues in tests
const originalBodyStyle = document.body.style.overflow;

describe('Modal', () => {
  beforeEach(() => {
    document.body.style.overflow = originalBodyStyle;
  });

  afterEach(() => {
    document.body.style.overflow = originalBodyStyle;
  });

  it('does not render when closed', () => {
    render(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(screen.queryByText('Modal content')).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(screen.getByText('Modal content')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('renders with title', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} title="Test Modal">
        <p>Modal content</p>
      </Modal>
    );
    
    expect(screen.getByText('Test Modal')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-labelledby', 'modal-title');
  });

  it('renders close button by default', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );
    
    const closeButton = screen.getByLabelText('Close modal');
    expect(closeButton).toBeInTheDocument();
    
    fireEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides close button when showCloseButton is false', () => {
    render(
      <Modal isOpen={true} onClose={vi.fn()} showCloseButton={false}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(screen.queryByLabelText('Close modal')).not.toBeInTheDocument();
  });

  it('calls onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );
    
    // Find backdrop by its class and role
    const backdrop = document.querySelector('.bg-black.bg-opacity-50');
    expect(backdrop).toBeTruthy();
    
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('calls onClose when Escape key is pressed', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );
    
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose for other keys', () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen={true} onClose={onClose}>
        <p>Modal content</p>
      </Modal>
    );
    
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('applies different sizes correctly', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()} size="sm">
        <p>Small modal</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveClass('max-w-md');

    rerender(
      <Modal isOpen={true} onClose={vi.fn()} size="md">
        <p>Medium modal</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveClass('max-w-lg');

    rerender(
      <Modal isOpen={true} onClose={vi.fn()} size="lg">
        <p>Large modal</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveClass('max-w-2xl');

    rerender(
      <Modal isOpen={true} onClose={vi.fn()} size="xl">
        <p>Extra large modal</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toHaveClass('max-w-4xl');
  });

  it('prevents body scroll when open', () => {
    const { unmount } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(document.body.style.overflow).toBe('hidden');
    
    unmount();
    expect(document.body.style.overflow).toBe('unset');
  });

  it('restores body scroll when closed', () => {
    const { rerender } = render(
      <Modal isOpen={true} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(document.body.style.overflow).toBe('hidden');
    
    rerender(
      <Modal isOpen={false} onClose={vi.fn()}>
        <p>Modal content</p>
      </Modal>
    );
    
    expect(document.body.style.overflow).toBe('unset');
  });
});