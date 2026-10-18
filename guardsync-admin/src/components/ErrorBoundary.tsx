import { Component, ErrorInfo, ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** When this changes (e.g. the route), a shown error is cleared so the new screen renders. */
  resetKey?: string;
  /** Goes to the dashboard inside the app; without it the page loads the app's start URL. */
  onBackToDashboard?: () => void;
}

interface ErrorBoundaryState {
  error: Error | null;
}

// Catches render errors and shows them with a way out, so a crash on one screen is never a
// dead end: 'Back to dashboard' clears the error and leaves the screen, 'Reload' starts over.
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("React Error:", error, errorInfo);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    // Browser Back/Forward or a link elsewhere: show the new screen instead of the old error
    if (this.state.error && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  private backToDashboard = () => {
    if (this.props.onBackToDashboard) {
      this.props.onBackToDashboard();
      this.setState({ error: null });
    } else {
      window.location.assign(import.meta.env.BASE_URL || "/");
    }
  };

  private reload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const buttonStyle = {
      padding: "8px 16px",
      borderRadius: 6,
      border: "1px solid #555",
      cursor: "pointer",
      fontFamily: "inherit",
    };
    return (
      <div role="alert" style={{ padding: 40, fontFamily: "monospace", background: "#1a1a1a", color: "#fff", minHeight: "100vh" }}>
        <h1 style={{ color: "#ff6b6b" }}>Something went wrong</h1>
        <p style={{ marginTop: 8 }}>This screen hit an error. You can go back to the dashboard or reload the app.</p>
        <div style={{ display: "flex", gap: 12, margin: "20px 0" }}>
          <button type="button" onClick={this.backToDashboard} style={{ ...buttonStyle, background: "#fff", color: "#1a1a1a" }}>
            Back to dashboard
          </button>
          <button type="button" onClick={this.reload} style={{ ...buttonStyle, background: "transparent", color: "#fff" }}>
            Reload
          </button>
        </div>
        <pre style={{ background: "#2a2a2a", padding: 20, borderRadius: 8, overflow: "auto", whiteSpace: "pre-wrap" }}>
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
      </div>
    );
  }
}

export default ErrorBoundary;
