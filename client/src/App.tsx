import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './stores/authStore';
import { Layout } from './components/Layout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function AppRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <div className="empty-state" role="status">Chargement...</div>;
  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<DashboardPage key="overview" view="overview" />} />
        <Route path="devis" element={<DashboardPage key="devis" view="devis" />} />
        <Route path="interventions" element={<DashboardPage key="interventions" view="interventions" />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
export function App() {
  return <AuthProvider><AppRoutes /></AuthProvider>;
}
