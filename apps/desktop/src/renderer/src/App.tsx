/**
 * Root React component.
 *
 * Phase 1 renders a minimal "foundation ready" shell only. Routing, the
 * Zustand stores, Shadcn/ui and the actual feature pages arrive in Phase 4.
 */
export function App(): JSX.Element {
  return (
    <main className="app-shell">
      <h1>Mode AI System</h1>
      <p>Foundation scaffold is ready. Feature development begins in later phases.</p>
    </main>
  );
}

export default App;
