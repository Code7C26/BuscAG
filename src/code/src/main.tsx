import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {reportError} from '../lib/reportError';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!, {
  onCaughtError: () => reportError('app_render_failed'),
  onUncaughtError: () => reportError('app_uncaught_error'),
}).render(
  <StrictMode>
    <AppErrorBoundary><App /></AppErrorBoundary>
  </StrictMode>,
);
