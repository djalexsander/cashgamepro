import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  showDebug: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, showDebug: false };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("[error-boundary] error", { error, errorInfo });
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDebug: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 mx-auto rounded-full bg-destructive/20 flex items-center justify-center">
              <span className="text-3xl">!</span>
            </div>
            <h1 className="text-xl font-bold text-foreground">Falha ao renderizar a tela</h1>
            <p className="text-sm text-muted-foreground">
              Ocorreu um erro inesperado na aplicação. Tente recarregar a página.
            </p>
            <div className="flex gap-2 justify-center">
              <button
                onClick={this.handleReload}
                className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Recarregar página
              </button>
              <button
                onClick={this.handleReset}
                className="px-4 py-2 rounded-md bg-muted text-muted-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              >
                Tentar novamente
              </button>
            </div>
            <button
              onClick={() => this.setState(prev => ({ showDebug: !prev.showDebug }))}
              className="text-xs text-muted-foreground underline"
            >
              {this.state.showDebug ? "Ocultar detalhes" : "Mostrar detalhes t?cnicos"}
            </button>
            {this.state.showDebug && this.state.error && (
              <div className="mt-2 p-3 rounded-md bg-muted text-left overflow-auto max-h-40">
                <p className="text-xs font-mono text-destructive break-all">
                  {this.state.error.message}
                </p>
                <pre className="text-[10px] font-mono text-muted-foreground mt-1 whitespace-pre-wrap break-all">
                  {this.state.error.stack}
                </pre>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
