import { render } from 'preact';
import './app.css';

// Placeholder entry point. The real Today/Execute/Pool/Movements/History/
// Settings screens (SPEC section 5) are built in a follow-up pass; this just
// proves the scaffold, domain layer, and storage wire together and build.
function App() {
  return <div class="app-placeholder">Workout App</div>;
}

const root = document.getElementById('app');
if (root) render(<App />, root);
