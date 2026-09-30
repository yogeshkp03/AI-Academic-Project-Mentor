import { Component } from 'react';

export class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 px-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-red-100 text-3xl">⚠️</div>
          <h1 className="text-2xl font-extrabold text-slate-900">Something went wrong</h1>
          <p className="max-w-md text-sm text-slate-500">
            An unexpected error occurred. Reload the page to try again, or check the console for details.
          </p>
          <pre className="max-w-lg truncate rounded-lg bg-slate-900 px-4 py-2 text-xs text-red-300">
            {String(this.state.error?.message || this.state.error)}
          </pre>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="cursor-pointer rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}