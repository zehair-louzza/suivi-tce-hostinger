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
  ) => Promise<void>;
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
        set({ isLoading: true, error: null });
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
        set({ isLoading: true, error: null });
        try {
          const response = await api.post('/auth/register', {
            name,
            email,
            password,
            companyName,
            siretOrSiren,
          });
          const { user, accessToken } = response.data;
          
          set({
            user,
            accessToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (err: any) {
          const message = err.response?.data?.error || "Erreur d'inscription";
          set({ error: message, isLoading: false, isAuthenticated: false });
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
        } catch {
          get().logout();
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
    if (isAuthenticated) {
      fetchMe();
    } else {
      // Check if we have a stored token and try to refresh
      const stored = useAuthStore.getState();
      if (stored.accessToken) {
        fetchMe().catch(() => {
          // If fetchMe fails, the user will be logged out
        });
      } else {
        useAuthStore.setState({ isLoading: false });
      }
    }
  }, [isAuthenticated, fetchMe]);

  return <Fragment>{children}</Fragment>;
}

// Hook for using auth
export function useAuth() {
  return useAuthStore();
}
