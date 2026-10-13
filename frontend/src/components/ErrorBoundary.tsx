import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("UI error:", error, info.componentStack); }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div role="alert" className="mx-auto max-w-md px-4 py-24 text-center">
        <h1 className="text-xl">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-500">An unexpected error occurred. Reloading the page usually fixes it.</p>
        <button className="mt-6 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white" onClick={() => window.location.reload()}>
          Reload page
        </button>
      </div>
    );
  }
}
