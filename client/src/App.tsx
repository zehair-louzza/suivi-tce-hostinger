import { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './stores/authStore';
import { LoginPage } from './pages/LoginPage';
import { AcceptInvitationPage } from './pages/AcceptInvitationPage';
import { DevisClientPage } from './pages/DevisClientPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';
import { PromoVideoShowcase } from './components/PromoVideoShowcase';

function AppRoutes() {
  const { isAuthenticated, isLoading, setLoading } = useAuth();
  const [showFallback, setShowFallback] = useState(false);

  useEffect(() => {
    if (isLoading) {
      const fallbackTimer = setTimeout(() => setShowFallback(true), 1500);
      const autoUnlockTimer = setTimeout(() => {
        setLoading(false);
      }, 2800);
      return () => {
        clearTimeout(fallbackTimer);
        clearTimeout(autoUnlockTimer);
      };
    } else {
      setShowFallback(false);
    }
  }, [isLoading, setLoading]);

  if (isLoading) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: 'var(--bg-app)',
          color: 'var(--text-primary)',
          padding: '20px',
        }}
      >
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '14px', maxWidth: '320px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent-primary)" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Chargement d'ANELEC Dispatch Pro...</p>
          {showFallback && (
            <button
              type="button"
              onClick={() => setLoading(false)}
              style={{
                marginTop: '8px',
                fontSize: '12px',
                fontWeight: 600,
                padding: '8px 16px',
                borderRadius: '8px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              Accéder à la page de connexion
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/invitation" element={<AcceptInvitationPage />} />
      <Route path="/devis-client/:jeton" element={<DevisClientPage />} />
      <Route path="/showcase" element={<PromoVideoShowcase />} />
      <Route path="/video" element={<PromoVideoShowcase />} />
      <Route path="/promo" element={<PromoVideoShowcase />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

export function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  );
}
