
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';

// Prevent ResizeObserver loop limit exceeded error from cluttering console
// This error is usually benign in React Flow contexts
const resizeObserverLoopErr = 'ResizeObserver loop completed with undelivered notifications.';
const originalError = window.console.error;
window.console.error = (...args) => {
  if (typeof args[0] === 'string' && args[0].includes(resizeObserverLoopErr)) {
    return;
  }
  originalError(...args);
};
window.addEventListener('error', (e) => {
  if (e.message === resizeObserverLoopErr) {
    e.stopImmediatePropagation();
  }
});


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>
);
