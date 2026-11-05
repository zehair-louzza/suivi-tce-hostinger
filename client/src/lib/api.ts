// API client with axios + Full ANELEC types & endpoints
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import {
  Devis,
  Intervention,
  ReferentielsMap,
  formatCurrency,
  formatDateFR,
  parseTimeIntervalInput,
  computeDurationHours,
  DEFAULT_REFERENTIELS,
  DEFAULT_TECHNICIEN_COMPETENCES,
  rankTechniciansForTrade,
  STATUTS_COMMERCIAUX_DEVIS,
  TRAITEMENTS_ADMIN,
  PROCHAINES_ACTIONS_DEVIS,
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_PLANIFICATION,
  STATUTS_OPERATIONNELS_INTERVENTION,
  STATUTS_FACTURE,
} from '../../../shared/types';

export type { Devis, Intervention, ReferentielsMap };
export {
  formatCurrency,
  formatDateFR,
  parseTimeIntervalInput,
  computeDurationHours,
  DEFAULT_REFERENTIELS,
  DEFAULT_TECHNICIEN_COMPETENCES,
  rankTechniciansForTrade,
  STATUTS_COMMERCIAUX_DEVIS,
  TRAITEMENTS_ADMIN,
  PROCHAINES_ACTIONS_DEVIS,
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_PLANIFICATION,
  STATUTS_OPERATIONNELS_INTERVENTION,
  STATUTS_FACTURE,
};

export const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for token refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: any) => void;
  reject: (reason: any) => void;
}> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await useAuthStore.getState().refreshToken();
        const newToken = useAuthStore.getState().accessToken;
        processQueue(null, newToken);
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export type StatsResponse = Record<string, number>;

export const devisApi = {
  list: (params?: { search?: string; status?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Devis>>('/devis', { params }),

  stats: () => api.get<StatsResponse>('/devis/stats'),

  get: (id: number) => api.get<{ data: Devis }>(`/devis/${id}`),

  create: (data: any) => api.post<{ data: Devis; message: string }>('/devis', data),

  update: (id: number, data: any) => api.patch<{ data: Devis; message: string }>(`/devis/${id}`, data),

  delete: (id: number) => api.delete<{ message: string }>(`/devis/${id}`),

  convert: (
    id: number,
    data?: {
      mode?: 'visite' | 'travaux';
      isVisiteDevis?: boolean;
      entreprise?: string;
      datePlanifiee?: string;
      heureDebut?: string;
      heureFin?: string;
      typeIntervention?: string;
      priorite?: string;
      notes?: string;
    }
  ) => api.post<{ data: Intervention; devis: Devis; message: string }>(`/devis/${id}/convert`, data || {}),
};

export const interventionApi = {
  list: (params?: { search?: string; status?: string; technicien?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Intervention>>('/interventions', { params }),

  stats: () => api.get<StatsResponse>('/interventions/stats'),

  get: (id: number) => api.get<{ data: Intervention }>(`/interventions/${id}`),

  create: (data: any) => api.post<{ data: Intervention; message: string }>('/interventions', data),

  update: (id: number, data: any) => api.patch<{ data: Intervention; message: string }>(`/interventions/${id}`, data),

  delete: (id: number) => api.delete<{ message: string }>(`/interventions/${id}`),
};

export const referentielsApi = {
  getAll: () => api.get<{ data: ReferentielsMap }>('/referentiels'),
  updateCategory: (categorie: keyof ReferentielsMap, valeurs: string[]) =>
    api.put<{ data: { categorie: string; valeurs: string[] }; message: string }>(`/referentiels/${categorie}`, {
      valeurs,
    }),
  updateCompetences: (competences: Record<string, string[]>) =>
    api.put<{ data: { categorie: string; valeurs: Record<string, string[]> }; message: string }>(
      '/referentiels/technicien_competences',
      { competences }
    ),
};

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
};

export const healthApi = {
  check: () => api.get('/health'),
  ready: () => api.get('/health/ready'),
};
