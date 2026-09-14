import React from "react";

/**
 * ErrorBoundary - Authentic Windows 98 Application Error Handler
 * Prevents mysterious blank screens and displays actionable diagnostics with reload options.
 */
export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("WaddleWord Uncaught Exception:", error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleResetStorage = () => {
    try {
      localStorage.clear();
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "#000080",
            color: "#ffffff",
            padding: "20px",
            boxSizing: "border-box",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 9999999,
          }}
        >
          <div
            className="win98-window"
            style={{
              maxWidth: "600px",
              width: "100%",
              color: "#000000",
              boxShadow: "4px 4px 16px rgba(0, 0, 0, 0.7)",
            }}
          >
            <div
              className="win98-titlebar"
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span>⚠ WaddleWord.exe - Application Error</span>
              <button
                className="win98-button win98-btn-sys"
                onClick={this.handleReload}
              >
                ✕
              </button>
            </div>
            <div
              style={{
                padding: "14px",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
                <span style={{ fontSize: "32px", lineHeight: 1 }}>🛑</span>
                <div>
                  <p style={{ margin: "0 0 4px 0", fontWeight: "bold", fontSize: "13px" }}>
                    An unhandled exception occurred in WaddleWord Next.
                  </p>
                  <p style={{ margin: 0, fontSize: "11px", color: "#444" }}>
                    {this.state.error?.message || String(this.state.error)}
                  </p>
                </div>
              </div>
              <div
                className="win98-sunken"
                style={{
                  padding: "8px",
                  background: "#fff",
                  fontFamily: "monospace",
                  fontSize: "10px",
                  maxHeight: "160px",
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  color: "#333",
                }}
              >
                {this.state.error?.stack || "No stack trace available."}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                  marginTop: "4px",
                }}
              >
                <button
                  className="win98-button"
                  onClick={this.handleResetStorage}
                  style={{ padding: "4px 10px", fontSize: "11px" }}
                >
                  Reset Settings &amp; Reload
                </button>
                <button
                  className="win98-button"
                  onClick={this.handleReload}
                  style={{ padding: "4px 14px", fontWeight: "bold", fontSize: "11px" }}
                >
                  Reload Application
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;
