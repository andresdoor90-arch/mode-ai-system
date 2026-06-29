/**
 * AppLayout — the application shell.
 *
 * Composes the persistent chrome (Sidebar + Header) around the routed page
 * content (`<Outlet />`), and mounts the app-wide providers/overlays:
 * `TooltipProvider` for hover hints and `Toaster` for notifications. The main
 * panel scrolls independently of the fixed sidebar and sticky header.
 */
import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

import { useAiStatusStore } from '../../store/aiStatusStore';
import { ErrorBoundary } from '../common/ErrorBoundary';
import { Toaster } from '../ui/toaster';
import { TooltipProvider } from '../ui/tooltip';
import { Header } from './Header';
import { Sidebar } from './Sidebar';

export function AppLayout(): JSX.Element {
  const refreshAiStatus = useAiStatusStore((state) => state.refresh);

  // Query the real AI-engine capability once the shell mounts, so the status
  // indicator reflects the actual orchestrator state instead of a fixed value.
  useEffect(() => {
    void refreshAiStatus();
  }, [refreshAiStatus]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex h-screen w-screen overflow-hidden bg-background">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-[1400px] px-6 py-7">
              <ErrorBoundary>
                <Outlet />
              </ErrorBoundary>
            </div>
          </main>
        </div>
      </div>
      <Toaster />
    </TooltipProvider>
  );
}
