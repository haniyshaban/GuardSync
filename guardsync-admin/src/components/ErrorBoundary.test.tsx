import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorBoundary } from './ErrorBoundary';

let shouldThrow = true;
function Crashy() {
  if (shouldThrow) throw new Error('Cannot read properties of undefined');
  return <p>Screen content</p>;
}

describe('ErrorBoundary', () => {
  it('shows the error with a way back to the dashboard', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrow = true;
    const onBack = vi.fn(() => { shouldThrow = false; });
    render(
      <ErrorBoundary onBackToDashboard={onBack}>
        <Crashy />
      </ErrorBoundary>
    );

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to dashboard' }));
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Screen content')).toBeInTheDocument();
  });

  it('clears the error when the route changes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    shouldThrow = true;
    const { rerender } = render(
      <ErrorBoundary resetKey="a">
        <Crashy />
      </ErrorBoundary>
    );
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();

    shouldThrow = false;
    rerender(
      <ErrorBoundary resetKey="b">
        <Crashy />
      </ErrorBoundary>
    );
    expect(screen.getByText('Screen content')).toBeInTheDocument();
  });
});
