import { Suspense, lazy, useEffect } from 'react';
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  type Location,
} from 'react-router-dom';
import { AppShell } from './components/AppShell';
import {
  setAuthFailureHandler,
  setRateLimitHandler,
} from './lib/spotify/client';
import AlbumPage from './pages/Album';
import ArtistPage from './pages/Artist';
import Home from './pages/Home';
import Search from './pages/Search';
import Settings from './pages/Settings';

// Code-split: Recharts (stats tab) only loads when the profile page opens.
const Profile = lazy(() => import('./pages/Profile'));
import { useArtistStore } from './store/artistStore';
import { useLogStore } from './store/logStore';
import { useUiStore } from './store/uiStore';

function Root() {
  const location = useLocation();
  const state = location.state as { background?: Location } | null;
  const background = state?.background;

  useEffect(() => {
    void useArtistStore.getState().loadAll();
    void useLogStore.getState().loadAll();
    setAuthFailureHandler(() => useUiStore.getState().setNeedsReconnect(true));
    setRateLimitHandler(() =>
      useUiStore.getState().pushToast('잠시 후 다시 시도해주세요'),
    );
  }, []);

  return (
    <>
      <Routes location={background ?? location}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Home />} />
          <Route path="/search" element={<Search />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
          <Route path="/album/:id" element={<AlbumPage />} />
          <Route
            path="/profile"
            element={
              <Suspense fallback={null}>
                <Profile />
              </Suspense>
            }
          />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      {background && (
        <Routes>
          <Route path="/album/:id" element={<AlbumPage overlay />} />
        </Routes>
      )}
    </>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Root />
    </HashRouter>
  );
}
