import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { handleAuthRedirect } from './lib/spotify/pkce';

async function bootstrap() {
  // Handle the Spotify PKCE `?code=` redirect before HashRouter takes over.
  await handleAuthRedirect();

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap();
