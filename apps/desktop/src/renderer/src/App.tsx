/**
 * Root React component.
 *
 * Defines the client-side route table inside the persistent `AppLayout` shell.
 * `HashRouter` is used because the renderer is served from the file system in
 * packaged builds (`file://`), where hash-based routing avoids deep-link 404s.
 * The ThemeProvider wraps everything so the chosen theme applies app-wide.
 */
import { HashRouter, Route, Routes } from 'react-router-dom';

import { AppLayout } from './components/layout/AppLayout';
import {
  CategoriesPage,
  DashboardPage,
  ExportPage,
  GarmentsPage,
  HistoryPage,
  ImportPage,
  NotFoundPage,
  ProfilePage,
  SettingsPage,
  WardrobePage,
} from './pages';
import { ThemeProvider } from './theme/ThemeProvider';

export function App(): JSX.Element {
  return (
    <ThemeProvider>
      <HashRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/wardrobe" element={<WardrobePage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/garments" element={<GarmentsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/export" element={<ExportPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ThemeProvider>
  );
}

export default App;
