import { Component, type ReactNode } from "react";

type ErrorBoundaryProps = {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
};

/** Catches render errors (e.g. malformed menu data) so one bad value shows a fallback instead of a white screen. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown) {
    console.error("restaurant-kit render error", error);
  }

  override render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

export function SiteErrorFallback() {
  return (
    <main style={{ padding: "2rem", textAlign: "center" }}>
      <h1>Something went wrong</h1>
      <p>Reload the page to try again.</p>
    </main>
  );
}
