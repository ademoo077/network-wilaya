import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient.js';
import { ErrorBoundary } from './components/ErrorBoundary.jsx';
import { installPreloadHandler } from './utils/lazyWithRetry.js';
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
installPreloadHandler();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider><ErrorBoundary><ThemeProvider><ToastProvider><QueryClientProvider client={queryClient}><AuthProvider><RefsProvider><App /></RefsProvider></AuthProvider></QueryClientProvider></ToastProvider></ThemeProvider></ErrorBoundary></I18nProvider>
  </React.StrictMode>,
);
