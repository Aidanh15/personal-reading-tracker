import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Grid from '../Grid';

describe('Grid', () => {
  it('renders children correctly', () => {
    render(
      <Grid>
        <div>Item 1</div>
        <div>Item 2</div>
        <div>Item 3</div>
      </Grid>
    );
    
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('applies default classes', () => {
    render(
      <Grid data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass('grid');
    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3'); // default 3 cols
    expect(grid).toHaveClass('gap-6'); // default md gap
  });

  it('applies different column configurations', () => {
    const { rerender } = render(
      <Grid cols={1} data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-1');

    rerender(
      <Grid cols={2} data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2');

    rerender(
      <Grid cols={3} data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3');

    rerender(
      <Grid cols={4} data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');

    rerender(
      <Grid cols={6} data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'md:grid-cols-3', 'lg:grid-cols-4', 'xl:grid-cols-6');
  });

  it('applies different gap sizes', () => {
    const { rerender } = render(
      <Grid gap="sm" data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('gap-3');

    rerender(
      <Grid gap="md" data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('gap-6');

    rerender(
      <Grid gap="lg" data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    expect(screen.getByTestId('grid')).toHaveClass('gap-8');
  });

  it('applies custom className', () => {
    render(
      <Grid className="custom-grid-class" data-testid="grid">
        <div>Item</div>
      </Grid>
    );
    
    expect(screen.getByTestId('grid')).toHaveClass('custom-grid-class');
  });

  it('combines all props correctly', () => {
    render(
      <Grid cols={4} gap="lg" className="custom-class" data-testid="grid">
        <div>Item 1</div>
        <div>Item 2</div>
      </Grid>
    );
    
    const grid = screen.getByTestId('grid');
    expect(grid).toHaveClass('grid');
    expect(grid).toHaveClass('grid-cols-1', 'sm:grid-cols-2', 'lg:grid-cols-3', 'xl:grid-cols-4');
    expect(grid).toHaveClass('gap-8');
    expect(grid).toHaveClass('custom-class');
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
  });
});