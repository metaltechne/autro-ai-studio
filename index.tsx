
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import './index.css';

// Prevent ResizeObserver loop limit exceeded error from cluttering console
// This error is usually benign in React Flow and dynamic layout contexts
const isResizeObserverError = (msg: any) => {
  if (typeof msg !== 'string') return false;
  return msg.includes('ResizeObserver loop completed') || 
         msg.includes('ResizeObserver loop limit exceeded');
};

const originalError = window.console.error;
window.console.error = (...args) => {
  if (args.length > 0 && isResizeObserverError(args[0])) {
    return;
  }
  originalError(...args);
};

window.addEventListener('error', (e) => {
  if (e.message && isResizeObserverError(e.message)) {
    e.stopImmediatePropagation();
    e.preventDefault();
  }
});


const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
