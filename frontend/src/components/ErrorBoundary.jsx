import { Component } from 'react';
import { Link } from 'react-router-dom';
import { Home } from 'lucide-react';

/** Shown when a view crashes. Keeps the brand intact in failure states. */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error:', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="grid min-h-screen place-items-center bg-canvas px-6">
          <div className="max-w-md text-center">
            <p className="eyebrow">Something went wrong</p>
            <h1 className="mt-2 text-[26px] font-semibold text-ink">
              This page could not be displayed
            </h1>
            <p className="mt-3 text-[14px] leading-relaxed text-ink-muted">
              The rest of your work is safe. Reloading usually resolves it — if it keeps
              happening, the details below help the developer find it.
            </p>
            <pre className="nice-scroll mt-4 max-h-32 overflow-auto rounded-xl border border-line bg-subtle p-3 text-left text-[12px] text-ink-soft">
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <div className="mt-6 flex justify-center gap-2">
              <Link
                to="/"
                className="inline-flex h-10 items-center gap-2 rounded-[10px] bg-brand-600 px-4 text-[14px] font-semibold text-white no-underline shadow-brand transition-colors hover:bg-brand-700"
              >
                <Home size={15} aria-hidden="true" />
                Back to home
              </Link>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex h-10 cursor-pointer items-center rounded-[10px] border border-line-strong bg-surface px-4 text-[14px] font-semibold text-ink-soft transition-colors hover:bg-subtle"
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
