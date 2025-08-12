import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Input from '../Input';

describe('Input', () => {
  it('renders with default props', () => {
    render(<Input placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toBeInTheDocument();
    expect(input).toHaveClass('border-gray-300');
  });

  it('renders with label', () => {
    render(<Input label="Username" placeholder="Enter username" />);
    const label = screen.getByText('Username');
    const input = screen.getByPlaceholderText('Enter username');
    
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('for', input.id);
  });

  it('shows error state correctly', () => {
    render(<Input error="This field is required" placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    const errorMessage = screen.getByText('This field is required');
    
    expect(input).toHaveClass('border-red-300');
    expect(errorMessage).toBeInTheDocument();
    expect(errorMessage).toHaveAttribute('role', 'alert');
  });

  it('shows helper text when no error', () => {
    render(<Input helperText="Enter at least 8 characters" placeholder="Password" />);
    const helperText = screen.getByText('Enter at least 8 characters');
    expect(helperText).toBeInTheDocument();
    expect(helperText).toHaveClass('text-gray-500');
  });

  it('prioritizes error over helper text', () => {
    render(
      <Input 
        error="Password too short" 
        helperText="Enter at least 8 characters" 
        placeholder="Password" 
      />
    );
    
    expect(screen.getByText('Password too short')).toBeInTheDocument();
    expect(screen.queryByText('Enter at least 8 characters')).not.toBeInTheDocument();
  });

  it('handles input changes', () => {
    const handleChange = vi.fn();
    render(<Input onChange={handleChange} placeholder="Enter text" />);
    
    const input = screen.getByPlaceholderText('Enter text');
    fireEvent.change(input, { target: { value: 'test value' } });
    
    expect(handleChange).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue('test value');
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" placeholder="Enter text" />);
    const input = screen.getByPlaceholderText('Enter text');
    expect(input).toHaveClass('custom-input');
  });

  it('forwards ref correctly', () => {
    const ref = vi.fn();
    render(<Input ref={ref} placeholder="Enter text" />);
    expect(ref).toHaveBeenCalled();
  });

  it('uses provided id', () => {
    render(<Input id="custom-id" label="Custom Label" />);
    const input = screen.getByRole('textbox');
    const label = screen.getByText('Custom Label');
    
    expect(input).toHaveAttribute('id', 'custom-id');
    expect(label).toHaveAttribute('for', 'custom-id');
  });

  it('generates unique id when not provided', () => {
    render(<Input label="Auto ID" />);
    const input = screen.getByRole('textbox');
    const label = screen.getByText('Auto ID');
    
    expect(input.id).toBeTruthy();
    expect(label).toHaveAttribute('for', input.id);
  });

  it('forwards other input props', () => {
    render(<Input type="email" required placeholder="Email" />);
    const input = screen.getByPlaceholderText('Email');
    
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('required');
  });
});