import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(
      "[ErrorBoundary] Uncaught error:",
      error,
      info.componentStack,
    );
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div
          style={{
            minHeight: "100dvh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
            background: "#0a0a0f",
            color: "#f0f0f5",
            fontFamily: "system-ui, sans-serif",
            textAlign: "center",
            gap: "16px",
          }}
        >
          <div style={{ fontSize: "40px" }}>🌸</div>
          <h1
            style={{
              fontSize: "20px",
              fontWeight: 700,
              margin: 0,
              color: "#f0f0f5",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "14px",
              color: "#9999bb",
              margin: 0,
              maxWidth: "320px",
              lineHeight: 1.6,
            }}
          >
            Sha ran into an unexpected error. Your data is safe — tap below to
            try again.
          </p>
          {this.state.error && (
            <p
              style={{
                fontSize: "11px",
                color: "#666688",
                margin: 0,
                fontFamily: "monospace",
                background: "#111122",
                padding: "8px 12px",
                borderRadius: "8px",
                maxWidth: "320px",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleReset}
            style={{
              marginTop: "8px",
              padding: "12px 28px",
              background: "oklch(0.65 0.18 280)",
              color: "#fff",
              border: "none",
              borderRadius: "12px",
              fontSize: "15px",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              background: "transparent",
              color: "#9999bb",
              border: "1px solid #333355",
              borderRadius: "12px",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Reload App
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
