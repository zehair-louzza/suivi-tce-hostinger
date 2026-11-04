// Vite entry point
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'react-hot-toast';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App';
import './styles/design-tokens.css';
import './styles/global.css';
import './styles/layout.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: 'var(--color-level3-surface)',
              color: 'var(--color-primary-text)',
              border: '1px solid var(--color-border-standard)',
              borderRadius: 'var(--rounded-card)',
              padding: '12px 16px',
            },
            success: {
              iconTheme: {
                primary: 'var(--color-success-emerald)',
                secondary: 'var(--color-inverse-text)',
              },
            },
            error: {
              iconTheme: {
                primary: 'var(--color-danger-red)',
                secondary: 'var(--color-inverse-text)',
              },
            },
          }}
        />
        <ReactQueryDevtools initialIsOpen={false} />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
