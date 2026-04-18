import { useState } from 'react';
import Home from './pages/Home';
import EventUpload from './pages/EventUpload';
import Upload from './pages/Upload';
import Results from './pages/Results';

export default function App() {
  const [page, setPage] = useState('home');
  const [grabId, setGrabId] = useState(null);

  function navigate(target, data) {
    if (target === 'results' && data) {
      setGrabId(data);
    }
    setPage(target);
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="logo" onClick={() => navigate('home')}>
          Grabpic
        </span>
        <a
          className="header-link"
          href={(import.meta.env.VITE_API_URL || 'http://localhost:3001') + '/api-docs'}
          target="_blank"
          rel="noopener noreferrer"
        >
          API Docs
        </a>
      </header>

      <main>
        {page === 'home' && <Home onNavigate={navigate} />}
        {page === 'event-upload' && <EventUpload onNavigate={navigate} />}
        {page === 'upload' && <Upload onNavigate={navigate} />}
        {page === 'results' && <Results grabId={grabId} onNavigate={navigate} />}
      </main>

      <footer className="app-footer">
        <p>Grabpic — Vyrothon 2026</p>
      </footer>
    </div>
  );
}
