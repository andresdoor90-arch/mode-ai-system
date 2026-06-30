/**
 * Root React component.
 *
 * Gates the application on the real user profile (persisted in SQLite):
 *  - while the initial profile lookup runs, a minimal splash is shown;
 *  - if no profile exists yet, the first-run onboarding is shown;
 *  - once a profile exists, the routed application renders.
 *
 * `HashRouter` is used because the renderer is served from the file system in
 * packaged builds (`file://`), where hash-based routing avoids deep-link 404s.
 * The ThemeProvider wraps everything so the chosen (dark) theme applies app-wide.
 */
import { useEffect } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';

import { OnboardingWizard } from './components/OnboardingWizard';
import { AppLayout } from './components/layout/AppLayout';
import {
  AdvisorPage,
  CategoriesPage,
  DashboardPage,
  ExportPage,
  GarmentsPage,
  HistoryPage,
  ImportPage,
  NotFoundPage,
  ProfilePage,
  SettingsPage,
  VirtualTryOnPage,
  WardrobePage,
} from './pages';
import { useUserStore } from './store/userStore';
import { ThemeProvider } from './theme/ThemeProvider';

function RoutedApp(): JSX.Element {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/wardrobe" element={<WardrobePage />} />
          <Route path="/categories" element={<CategoriesPage />} />
          <Route path="/garments" element={<GarmentsPage />} />
          <Route path="/advisor" element={<AdvisorPage />} />
          <Route path="/try-on" element={<VirtualTryOnPage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

function Gate(): JSX.Element {
  const loaded = useUserStore((state) => state.loaded);
  const hasProfile = useUserStore((state) => state.hasProfile);
  const loadProfile = useUserStore((state) => state.loadProfile);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  if (!loaded) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background text-muted-foreground">
        <span className="text-sm">Cargando…</span>
      </div>
    );
  }

  if (!hasProfile) {
    return <OnboardingWizard />;
  }

  return <RoutedApp />;
}

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <Gate />
    </ThemeProvider>
  );
}

export default App;
