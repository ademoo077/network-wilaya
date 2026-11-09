import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { RefsProvider } from './context/RefsContext.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { ThemeProvider } from './hooks/useTheme.jsx';
import { ToastProvider } from './components/ui/index.js';
import { installClientErrorHandlers } from './utils/clientErrors.js';
import './styles/tokens.css';
import './styles/index.css';

installClientErrorHandlers();
window.addEventListener('vite:preloadError', () => { window.location.reload(); });

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider><ThemeProvider><ToastProvider><AuthProvider><RefsProvider><App /></RefsProvider></AuthProvider></ToastProvider></ThemeProvider></I18nProvider>
  </React.StrictMode>,
);
