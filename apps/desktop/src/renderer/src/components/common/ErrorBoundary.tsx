/**
 * ErrorBoundary — contains render-time failures to the page area.
 *
 * Wraps the routed page content so that if any single screen throws while
 * rendering, the application shell (sidebar, header) and — crucially — the
 * first-run onboarding gate keep working, instead of the whole window going
 * blank. The user sees a recoverable message and can navigate away or retry.
 *
 * This is a deliberate resilience guard: no feature should ever be able to take
 * down the entire app.
 */
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '../ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null };
  }

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  public override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surface the failure for diagnostics without crashing the shell.
    // eslint-disable-next-line no-console
    console.error('Page render error:', error, info.componentStack);
  }

  private readonly reset = (): void => {
    this.setState({ error: null });
  };

  public override render(): ReactNode {
    const { error } = this.state;
    if (error !== null) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
            <AlertTriangle className="h-7 w-7" />
          </div>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              Algo salió mal en esta pantalla
            </h2>
            <p className="max-w-md text-sm text-muted-foreground">
              El resto de la aplicación sigue funcionando. Puedes reintentar o cambiar de sección
              desde el menú lateral.
            </p>
          </div>
          <Button variant="outline" onClick={this.reset}>
            <RotateCcw className="h-4 w-4" />
            Reintentar
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
