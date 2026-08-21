import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: React.ReactNode;
  /** Optional label so the fallback can name the area that failed. */
  section?: string;
}

interface State {
  error: Error | null;
}

/**
 * Catches render-time exceptions.
 *
 * Without this, any thrown error in a page unmounts the whole React tree and the user
 * is left staring at a blank dark screen with no way to recover — which is exactly what
 * happened when the chat widget tried to call .map() on a JSON string.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Kept as console.error deliberately: this is the last stop before a blank screen,
    // and in production it is the only signal an operator has.
    console.error('Render error caught by ErrorBoundary:', error, info.componentStack);
  }

  private reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div role="alert" className="min-h-[400px] flex items-center justify-center p-6">
        <div className="max-w-lg w-full glass-card rounded-3xl border border-rose-500/30 p-8 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
            <AlertTriangle className="w-6 h-6" aria-hidden="true" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-bold text-white">
              {this.props.section ? `${this.props.section} could not be displayed` : 'Something went wrong'}
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              An unexpected error occurred while rendering this view. Your data is safe — try reloading.
            </p>
          </div>

          {import.meta.env.DEV && (
            <pre className="text-[10px] text-left text-rose-300/80 bg-dark-bg/80 border border-dark-border rounded-xl p-3 overflow-auto max-h-40">
              {error.message}
            </pre>
          )}

          <div className="flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={this.reset}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-500 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none text-white text-xs font-semibold transition"
            >
              <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-slate-500 text-slate-300 text-xs font-semibold transition"
            >
              Reload page
            </button>
          </div>
        </div>
      </div>
    );
  }
}
