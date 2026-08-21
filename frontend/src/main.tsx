import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSentry } from './utils/sentry';

// Before render, so a failure during the first mount is still reported.
// A no-op unless VITE_SENTRY_DSN is set.
initSentry();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
