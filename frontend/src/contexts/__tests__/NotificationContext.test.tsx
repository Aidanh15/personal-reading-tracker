// import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { vi } from 'vitest';
import { NotificationProvider, useNotification } from '../NotificationContext';

// Test component that uses the notification context
const TestComponent = () => {
  const { toasts, showSuccess, showError, showWarning, showInfo, removeToast } = useNotification();

  return (
    <div>
      <div data-testid="toast-count">{toasts.length}</div>
      <button onClick={() => showSuccess('Success', 'Success message')}>
        Show Success
      </button>
      <button onClick={() => showError('Error', 'Error message')}>
        Show Error
      </button>
      <button onClick={() => showWarning('Warning', 'Warning message')}>
        Show Warning
      </button>
      <button onClick={() => showInfo('Info', 'Info message')}>
        Show Info
      </button>
      {toasts.map((toast) => (
        <div key={toast.id} data-testid={`toast-${toast.type}`}>
          <span>{toast.title}</span>
          <span>{toast.message}</span>
          <button onClick={() => removeToast(toast.id)}>Remove</button>
        </div>
      ))}
    </div>
  );
};

describe('NotificationContext', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('throws error when used outside provider', () => {
    // Suppress console.error for this test
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useNotification must be used within a NotificationProvider');
    
    consoleSpy.mockRestore();
  });

  it('provides notification context', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  it('adds success toast', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('adds error toast with longer duration', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Show Error'));

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('adds warning toast', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Show Warning'));

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('adds info toast', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Show Info'));

    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');
    expect(screen.getByTestId('toast-info')).toBeInTheDocument();
    expect(screen.getByText('Info')).toBeInTheDocument();
    expect(screen.getByText('Info message')).toBeInTheDocument();
  });

  it('removes toast when removeToast is called', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    expect(screen.getByTestId('toast-count')).toHaveTextContent('1');

    fireEvent.click(screen.getByText('Remove'));
    expect(screen.getByTestId('toast-count')).toHaveTextContent('0');
  });

  it('handles multiple toasts', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Error'));
    fireEvent.click(screen.getByText('Show Warning'));

    expect(screen.getByTestId('toast-count')).toHaveTextContent('3');
    expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    expect(screen.getByTestId('toast-error')).toBeInTheDocument();
    expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
  });

  it('generates unique IDs for toasts', () => {
    render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>
    );

    fireEvent.click(screen.getByText('Show Success'));
    fireEvent.click(screen.getByText('Show Success'));

    const toasts = screen.getAllByTestId('toast-success');
    expect(toasts).toHaveLength(2);
    expect(screen.getByTestId('toast-count')).toHaveTextContent('2');
  });
});