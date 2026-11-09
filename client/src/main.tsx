// Vite entry point
import React, { useEffect } from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import toast, { Toaster, useToasterStore } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import { ThemeProvider } from './stores/themeStore';
import './styles/design-tokens.css';
import './styles/themes.css';
import './styles/global.css';
import './styles/layout.css';
import './styles/terrain-mobile.css';
import './styles/atlas-clarity.css';
import { registerServiceWorker } from './components/InstallAppButton';

// Purge service workers pour garantir la dernière version sans cache rémanent
if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const r of regs) {
      r.update();
    }
  });
}
registerServiceWorker();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

/**
 * Gestionnaire de notifications éphémères (Toasts) :
 * - Fond blanc 100% opaque (#ffffff), non transparent
 * - Aucun chevauchement (1 seul message affiché à la fois, les précédents sont fermés automatiquement)
 * - Disparition automatique rapide (2,5 secondes)
 */
function EphemeralToaster() {
  const { toasts } = useToasterStore();

  useEffect(() => {
    toasts
      .filter((t) => t.visible)
      .filter((_, i) => i >= 1)
      .forEach((t) => toast.dismiss(t.id));
  }, [toasts]);

  return (
    <Toaster
      position="top-center"
      gutter={8}
      containerStyle={{
        top: 12,
        zIndex: 99999,
      }}
      toastOptions={{
        duration: 2500,
        style: {
          background: '#ffffff',
          backgroundColor: '#ffffff',
          color: '#0f172a',
          border: '1.5px solid #cbd5e1',
          borderRadius: '12px',
          padding: '12px 16px',
          boxShadow: '0 14px 32px rgba(15, 23, 42, 0.2), 0 4px 10px rgba(15, 23, 42, 0.08)',
          fontWeight: 600,
          fontSize: '13px',
          lineHeight: 1.4,
          maxWidth: '400px',
          opacity: 1,
        },
        success: {
          duration: 2500,
          style: {
            background: '#ffffff',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            border: '1.5px solid #10b981',
            borderLeft: '5px solid #059669',
          },
          iconTheme: {
            primary: '#059669',
            secondary: '#ffffff',
          },
        },
        error: {
          duration: 3000,
          style: {
            background: '#ffffff',
            backgroundColor: '#ffffff',
            color: '#0f172a',
            border: '1.5px solid #f87171',
            borderLeft: '5px solid #dc2626',
          },
          iconTheme: {
            primary: '#dc2626',
            secondary: '#ffffff',
          },
        },
      }}
    />
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ThemeProvider>
          <App />
          <EphemeralToaster />
          <ReactQueryDevtools initialIsOpen={false} />
        </ThemeProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
