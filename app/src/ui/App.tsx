import { useEffect } from 'preact/hooks';
import { LocationProvider, Route, Router, useLocation } from 'preact-iso';
import { init, state } from '../state/store';
import { BottomNav } from './components/BottomNav';
import { Today } from './pages/Today';
import { Run } from './pages/Run';
import { Pool } from './pages/Pool';
import { PoolEditor } from './pages/PoolEditor';
import { Movements } from './pages/Movements';
import { MovementEditor } from './pages/MovementEditor';
import { History } from './pages/History';
import { HistoryDetail } from './pages/HistoryDetail';
import { EditLog } from './pages/EditLog';
import { AdhocLog } from './pages/AdhocLog';
import { Settings } from './pages/Settings';

function NotFound() {
  return (
    <div class="empty-state">
      <p>Page not found.</p>
      <a href="/">Go to Today</a>
    </div>
  );
}

function AppShell() {
  const { path } = useLocation();
  const showNav = path !== '/run';
  return (
    <div class={`app-shell${showNav ? ' with-nav' : ''}`}>
      <main class="app-main">
        <Router>
          <Route path="/" component={Today} />
          <Route path="/run" component={Run} />
          <Route path="/pool" component={Pool} />
          <Route path="/pool/new" component={PoolEditor} />
          <Route path="/pool/:id" component={PoolEditor} />
          <Route path="/movements" component={Movements} />
          <Route path="/movements/:id" component={MovementEditor} />
          <Route path="/history" component={History} />
          <Route path="/history/adhoc" component={AdhocLog} />
          <Route path="/history/:id/edit" component={EditLog} />
          <Route path="/history/:id" component={HistoryDetail} />
          <Route path="/settings" component={Settings} />
          <Route default component={NotFound} />
        </Router>
      </main>
      {showNav && <BottomNav path={path} />}
    </div>
  );
}

export function App() {
  useEffect(() => {
    void init();
  }, []);

  if (!state.value) {
    return <div class="loading-screen">Loading…</div>;
  }

  return (
    <LocationProvider>
      <AppShell />
    </LocationProvider>
  );
}
