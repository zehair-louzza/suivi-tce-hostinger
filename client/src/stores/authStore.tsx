// Auth store with Zustand
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { api } from '../lib/api';
import { User } from '../../../shared/types';
import { Fragment } from 'react';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  login: (email: string, password: string) => Promise<void>;
  register: (
    name: string,
    email: string,
    password: string,
    companyName?: string,
    siretOrSiren?: string
  ) => Promise<any>;
  loginWithGoogle: (payload: {
    credential: string;
    name?: string;
    companyName?: string;
    siretOrSiren?: string;
    acceptTerms?: boolean;
  }) => Promise<{ requiresCompanyInfo?: boolean; googleProfile?: any; message?: string }>;
  confirmSupabaseToken: (accessToken: string) => Promise<any>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
  fetchMe: () => Promise<void>;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      setLoading: (loading: boolean) => set({ isLoading: loading }),

      clearError: () => set({ error: null }),

      login: async (email: string, password: string) => {
        set({ error: null });
        try {
          const response = await api.post('/auth/login', { email, password });
          const { user, accessToken } = response.data;
          
          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: any) {
          const message = err.response?.data?.error || 'Erreur de connexion';
          set({ error: message, isLoading: false, isAuthenticated: false });
          throw err;
        }
      },

      register: async (
        name: string,
        email: string,
        password: string,
        companyName?: string,
        siretOrSiren?: string
      ) => {
        set({ error: null });
        try {
          const response = await api.post('/auth/register', {
            name,
            email,
            password,
            companyName,
            siretOrSiren,
          });
          const { user, accessToken, requiresConfirmation } = response.data;

          if (requiresConfirmation || !accessToken || !user) {
            // L'espace entreprise a été créé mais nécessite l'activation par e-mail
            set({
              user: null,
              accessToken: null,
              isAuthenticated: false,
              isLoading: false,
              error: null,
            });
            return response.data;
          }

          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return response.data;
        } catch (err: any) {
          const message = err.response?.data?.error || "Erreur d'inscription";
          set({ error: message, isLoading: false, isAuthenticated: false });
          throw err;
        }
      },

      loginWithGoogle: async (payload: {
        credential: string;
        name?: string;
        companyName?: string;
        siretOrSiren?: string;
        acceptTerms?: boolean;
      }) => {
        // IMPORTANT : Ne pas activer isLoading: true ici pour ne pas démonter <LoginPage />
        // lorsque Google retourne requiresCompanyInfo: true (inscription rapide Google) !
        set({ error: null });
        try {
          const response = await api.post('/auth/google', payload);
          const { user, accessToken, requiresCompanyInfo, googleProfile, message } = response.data;
          if (requiresCompanyInfo) {
            return { requiresCompanyInfo: true, googleProfile, message };
          }
          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return { requiresCompanyInfo: false, googleProfile, message };
        } catch (err: any) {
          const message = err.response?.data?.error || 'Erreur lors de la connexion Google';
          set({ error: message, isLoading: false, isAuthenticated: false });
          throw err;
        }
      },

      confirmSupabaseToken: async (accessToken: string) => {
        set({ error: null });
        try {
          const response = await api.post('/auth/confirm-supabase-token', { accessToken });
          const { user, accessToken: jwtToken } = response.data;
          set({
            user,
            accessToken: jwtToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return response.data;
        } catch (err: any) {
          const message = err.response?.data?.error || 'Erreur de validation du lien e-mail';
          set({ error: message, isLoading: false });
          throw err;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await api.post('/auth/logout');
        } catch {
          // Ignore logout errors
        } finally {
          set({
            user: null,
            accessToken: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      refreshToken: async () => {
        try {
          const response = await api.post('/auth/refresh');
          const { accessToken } = response.data;
          set({ accessToken });
        } catch (err) {
          get().logout();
          throw err;
        }
      },

      fetchMe: async () => {
        set({ isLoading: true });
        try {
          const response = await api.get('/auth/me');
          const { user } = response.data;
          set({ user, isAuthenticated: true, isLoading: false });
        } catch {
          set({ user: null, isAuthenticated: false, isLoading: false });
        }
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Provider component
import { ReactNode, useEffect } from 'react';

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const { fetchMe, isAuthenticated } = useAuthStore();

  useEffect(() => {
    // Si l'URL contient un retour OAuth Google (#id_token / #access_token) ou confirmation Supabase (#type=signup),
    // on sauvegarde le hash en sessionStorage et on déverrouille immédiatement l'affichage de LoginPage
    if (
      typeof window !== 'undefined' &&
      window.location.hash &&
      (window.location.hash.includes('id_token=') ||
        window.location.hash.includes('access_token=') ||
        window.location.hash.includes('type=signup'))
    ) {
      try {
        sessionStorage.setItem('anelec_oauth_hash', window.location.hash.substring(1));
      } catch {
        // ignore storage error
      }
      useAuthStore.setState({ isLoading: false, isAuthenticated: false });
      return;
    }

    // Sécurité globale anti-blocage (ex: réseau lent, transition d'état)
    const safetyTimer = setTimeout(() => {
      if (useAuthStore.getState().isLoading) {
        console.warn('[AuthProvider] Sécurité anti-blocage : déverrouillage automatique du chargement');
        useAuthStore.setState({ isLoading: false });
      }
    }, 3500);

    if (isAuthenticated) {
      fetchMe().finally(() => clearTimeout(safetyTimer));
    } else {
      // Check if we have a stored token and try to refresh
      const stored = useAuthStore.getState();
      if (stored.accessToken) {
        fetchMe()
          .finally(() => clearTimeout(safetyTimer))
          .catch(() => {
            // If fetchMe fails, the user will be logged out
          });
      } else {
        clearTimeout(safetyTimer);
        useAuthStore.setState({ isLoading: false });
      }
    }

    return () => clearTimeout(safetyTimer);
  }, [isAuthenticated, fetchMe]);

  return <Fragment>{children}</Fragment>;
}

// Hook for using auth
export function useAuth() {
  return useAuthStore();
}
