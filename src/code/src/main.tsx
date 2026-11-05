import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import {PresentationNotice} from './components/PresentationNotice';
import {reportError} from '../lib/reportError';
import {AppErrorBoundary} from './components/AppErrorBoundary';
import 'leaflet/dist/leaflet.css';
import './index.css';

createRoot(document.getElementById('root')!, {
  onCaughtError: () => reportError('app_render_failed'),
  onUncaughtError: () => reportError('app_uncaught_error'),
}).render(
  <StrictMode>
    <AppErrorBoundary><PresentationNotice enabled={import.meta.env.MODE==='presentation'}/><App /></AppErrorBoundary>
  </StrictMode>,
);

// Static offline fallback only. Never cache authenticated responses or app data.
if(import.meta.env.PROD&&'serviceWorker' in navigator){
  window.addEventListener('load',()=>{void navigator.serviceWorker.register('/sw.js').catch(()=>reportError('service_worker_registration_failed'));});
}
