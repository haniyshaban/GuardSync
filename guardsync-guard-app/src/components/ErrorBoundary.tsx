import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** What to show instead of the broken part. Gets a function that tries again. */
  fallback?: (retry: () => void) => React.ReactNode;
  /** When this value changes, a shown error is cleared and the children are tried again */
  resetKey?: unknown;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Stops an error in one part of the app from blanking the whole screen.
 * Without a boundary React unmounts everything when a component throws while rendering.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('A screen failed to render:', error, info.componentStack);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  retry = () => this.setState({ error: null });

  render() {
    if (!this.state.error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(this.retry);
    return (
      <div className="flex flex-col items-center justify-center text-center p-6">
        <AlertTriangle className="w-8 h-8 text-warning mb-3" />
        <p className="font-medium text-foreground mb-1">Something went wrong</p>
        <p className="text-sm text-muted-foreground mb-4">This part of the app could not be shown.</p>
        <Button variant="outline" size="sm" onClick={this.retry}>
          Try again
        </Button>
      </div>
    );
  }
}

export default ErrorBoundary;
