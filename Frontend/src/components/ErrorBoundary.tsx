"use client";

import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[GAAS ErrorBoundary]", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: 32,
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            color: "#111827",
            background: "#f9fafb",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
            Terjadi Kesalahan
          </h1>
          <p style={{ fontSize: 15, color: "#6b7280", maxWidth: 480, marginBottom: 24, lineHeight: 1.6 }}>
            Aplikasi mengalami masalah yang tidak terduga. Silakan muat ulang halaman.
            Jika masalah berlanjut, hubungi tim IT.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 24px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "#2563eb",
              border: "none",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Muat Ulang Halaman
          </button>
          {process.env.NODE_ENV === "development" && this.state.error && (
            <pre
              style={{
                marginTop: 24,
                padding: 16,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                borderRadius: 8,
                fontSize: 12,
                color: "#991b1b",
                maxWidth: 600,
                overflow: "auto",
                textAlign: "left",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {this.state.error.message}
              {"\n"}
              {this.state.error.stack}
            </pre>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
