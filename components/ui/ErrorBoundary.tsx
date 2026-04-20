
import React from 'react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  public static getDerivedStateFromError(error: any): State {
    const msg = error?.message || String(error);
    if (msg.includes('ResizeObserver loop completed') || 
        msg.includes('ResizeObserver loop limit exceeded')) {
      return { hasError: false, error: null };
    }
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-slate-50 text-center">
          <div className="w-20 h-20 mb-6 rounded-2xl bg-red-100 flex items-center justify-center">
            <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ops! Algo deu errado.</h1>
          <p className="text-slate-600 mb-8 max-w-md mx-auto">
            Ocorreu um erro inesperado no aplicativo. Tentamos conter o problema, mas se persistir, por favor recarregue a página.
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-autro-blue text-white rounded-xl font-bold shadow-lg shadow-autro-blue/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Recarregar Sistema
            </button>
            <button
              onClick={() => this.setState({ hasError: false, error: null })}
              className="px-6 py-3 bg-white text-slate-600 border border-slate-200 rounded-xl font-bold hover:bg-slate-50 transition-all"
            >
              Tentar Novamente
            </button>
          </div>
          {this.state.error && (
            <div className="mt-12 p-4 bg-slate-100 rounded-lg text-left overflow-auto max-w-2xl w-full">
              <p className="text-xs font-mono text-red-800">{this.state.error.toString()}</p>
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
