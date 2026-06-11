import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error("ErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "100vh", display: "flex", alignItems: "center",
          justifyContent: "center", flexDirection: "column", gap: 16,
          background: "var(--background)", padding: 40,
        }}>
          <div style={{ width: 56, height: 56, borderRadius: "50%", background: "var(--error-container)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 28, color: "var(--error)", fontVariationSettings: "'FILL' 1" }}>error</span>
          </div>
          <div style={{ textAlign: "center", maxWidth: 400 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: "var(--on-surface)", marginBottom: 8 }}>Something went wrong</h2>
            <p style={{ fontSize: 13, color: "var(--on-surface-variant)", lineHeight: 1.6, marginBottom: 20 }}>
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <button
              className="btn-primary"
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>refresh</span>
              Reload Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
