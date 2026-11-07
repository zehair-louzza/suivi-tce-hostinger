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
  ROLE_DEFINITIONS,
  getEffectivePermissions,
  ACTIONS_PREREMPLIES_TERRAIN,
  User,
  UserPermissions,
  UserRoleCode,
  TerrainPhoto,
  PointageTechnicienItem,
  EquipeJournaliere,
  ClientProfile,
  ClientProfileType,
  ClientServiceContact,
  DEFAULT_CLIENT_PROFILES,
  SendReportEmailPayload,
  GpsPositionPayload,
  STATUTS_COMMERCIAUX_DEVIS,
  TRAITEMENTS_ADMIN,
  PROCHAINES_ACTIONS_DEVIS,
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_PLANIFICATION,
  STATUTS_OPERATIONNELS_INTERVENTION,
  STATUTS_FACTURE,
  computeDevisCalculations,
  computeInterventionCalculations,
  getTodayParisISO,
} from '../../../shared/types';

export type {
  Devis,
  Intervention,
  ReferentielsMap,
  User,
  UserPermissions,
  UserRoleCode,
  TerrainPhoto,
  PointageTechnicienItem,
  EquipeJournaliere,
  ClientProfile,
  ClientProfileType,
  ClientServiceContact,
  SendReportEmailPayload,
  GpsPositionPayload,
};
export {
  formatCurrency,
  formatDateFR,
  parseTimeIntervalInput,
  computeDurationHours,
  DEFAULT_REFERENTIELS,
  DEFAULT_CLIENT_PROFILES,
  DEFAULT_TECHNICIEN_COMPETENCES,
  rankTechniciansForTrade,
  ROLE_DEFINITIONS,
  getEffectivePermissions,
  ACTIONS_PREREMPLIES_TERRAIN,
  STATUTS_COMMERCIAUX_DEVIS,
  TRAITEMENTS_ADMIN,
  PROCHAINES_ACTIONS_DEVIS,
  PRIORITES,
  TYPES_INTERVENTION,
  MODES_PLANIFICATION,
  STATUTS_OPERATIONNELS_INTERVENTION,
  STATUTS_FACTURE,
  computeDevisCalculations,
  computeInterventionCalculations,
  getTodayParisISO,
};

export const api = axios.create({
  baseURL: '/api',
  timeout: 8000,
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

    // Ne jamais intercepter les endpoints d'authentification pour éviter les blocages / boucles infinies
    const url = originalRequest?.url || '';
    const isAuthEndpoint =
      url.includes('/auth/login') ||
      url.includes('/auth/register') ||
      url.includes('/auth/resend-confirmation') ||
      url.includes('/auth/forgot-password') ||
      url.includes('/auth/reset-password') ||
      url.includes('/auth/confirm-supabase-token') ||
      url.includes('/auth/refresh') ||
      url.includes('/auth/logout') ||
      url.includes('/auth/google') ||
      url.includes('/auth/config');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (token && originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
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
        if (newToken && originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        useAuthStore.getState().logout();
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
      objet?: string;
    }
  ) => api.post<{ data: Intervention; devis: Devis; message: string }>(`/devis/${id}/convert`, data || {}),

  sendDevisEmail: (
    id: number,
    payload: { toEmail: string; ccEmail?: string; subject?: string; customMessage?: string }
  ) =>
    api.post<{
      success: boolean;
      data: Devis;
      deliveryChannel?: string;
      previewUrl?: string | null;
      message: string;
    }>(`/devis/${id}/send-devis-email`, payload),
};

export const interventionApi = {
  list: (params?: { search?: string; status?: string; technicien?: string; page?: number; limit?: number }) =>
    api.get<PaginatedResponse<Intervention>>('/interventions', { params }),

  stats: () => api.get<StatsResponse>('/interventions/stats'),

  get: (id: number) => api.get<{ data: Intervention }>(`/interventions/${id}`),

  create: (data: any) => api.post<{ data: Intervention; message: string }>('/interventions', data),

  update: (id: number, data: any) => api.patch<{ data: Intervention; message: string }>(`/interventions/${id}`, data),

  delete: (id: number) => api.delete<{ message: string }>(`/interventions/${id}`),

  sendReportEmail: (id: number, payload: SendReportEmailPayload) =>
    api.post<{
      success: boolean;
      data: Intervention;
      deliveryChannel?: string;
      previewUrl?: string | null;
      message: string;
    }>(
      `/interventions/${id}/send-report-email`,
      payload
    ),
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
  updateEquipes: (equipes: EquipeJournaliere[]) =>
    api.put<{ data: { categorie: string; valeurs: EquipeJournaliere[] }; message: string }>(
      '/referentiels/equipes_journalieres',
      { equipes }
    ),
  updateClientsFiches: (fiches: ClientProfile[]) =>
    api.put<{ data: { categorie: string; valeurs: ClientProfile[] }; message: string }>(
      '/referentiels/clients_fiches',
      { fiches }
    ),
  sendGpsPosition: (payload: GpsPositionPayload) =>
    api.post<{
      data: GpsPositionPayload;
      positions_gps_techniciens: Record<string, GpsPositionPayload>;
      message: string;
    }>('/referentiels/gps-position', payload),
};

export const authApi = {
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post('/auth/register', { name, email, password }),
  resendConfirmation: (email: string) =>
    api.post<{
      message: string;
      emailSent?: boolean;
      alreadyConfirmed?: boolean;
      deliveryChannel?: string;
      previewUrl?: string | null;
      activationLink?: string | null;
    }>('/auth/resend-confirmation', { email }),
  forgotPassword: (email: string) =>
    api.post<{
      message: string;
      emailSent?: boolean;
      deliveryChannel?: string;
      previewUrl?: string | null;
      resetLink?: string | null;
    }>('/auth/forgot-password', { email }),
  resetPassword: (token: string, password: string) =>
    api.post<{ user: User; accessToken: string; message: string }>('/auth/reset-password', {
      token,
      password,
    }),
  confirmSupabaseToken: (accessToken: string) =>
    api.post<{ user: User; accessToken: string; message: string }>('/auth/confirm-supabase-token', {
      accessToken,
    }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  refresh: () => api.post('/auth/refresh'),
  googleAuth: (payload: {
    credential: string;
    name?: string;
    companyName?: string;
    siretOrSiren?: string;
    acceptTerms?: boolean;
  }) =>
    api.post<{
      user?: User;
      accessToken?: string;
      requiresCompanyInfo?: boolean;
      googleProfile?: { email: string; name: string; picture?: string };
      message: string;
    }>('/auth/google', payload),
  getAuthConfig: () => api.get<{ googleClientId: string }>('/auth/config'),
};

export const adminApi = {
  listUsers: () => api.get<{ data: User[] }>('/admin/users'),
  createUser: (payload: {
    name: string;
    email: string;
    password?: string;
    role: string;
    technicienNom?: string | null;
    permissions?: UserPermissions;
  }) =>
    api.post<{
      data: User;
      emailSent?: boolean;
      deliveryChannel?: string;
      previewUrl?: string | null;
      message: string;
    }>('/admin/users', payload),
  updateUser: (
    id: number,
    payload: {
      name?: string;
      email?: string;
      password?: string;
      role?: string;
      technicienNom?: string | null;
      permissions?: UserPermissions;
      active?: boolean;
    }
  ) => api.put<{ data: User; message: string }>(`/admin/users/${id}`, payload),
  deleteUser: (id: number) => api.delete<{ message: string }>(`/admin/users/${id}`),
  listPointages: (params?: { dateJour?: string; technicien?: string }) =>
    api.get<{ data: PointageTechnicienItem[] }>('/admin/pointages', { params }),
  clockIn: (payload: {
    technicien: string;
    dateJour?: string;
    heureArriveeBureau?: string;
    commentaireJournee?: string;
  }) => api.post<{ data: PointageTechnicienItem; message: string }>('/admin/pointages/clock-in', payload),
  clockOut: (payload: {
    technicien: string;
    dateJour?: string;
    heureFinJournee?: string;
    derniereInterventionRef?: string;
    commentaireJournee?: string;
  }) => api.post<{ data: PointageTechnicienItem; message: string }>('/admin/pointages/clock-out', payload),
  destroyCompany: (payload: { password: string; confirmPhrase?: string }) =>
    api.delete<{ message: string; destroyedCompanyId: number }>('/admin/company/destroy', { data: payload }),
  getSmtpStatus: () =>
    api.get<{
      config: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        fromName: string;
        hasPassword: boolean;
        updatedAt?: string;
      };
      logs: any[];
    }>('/admin/smtp-status'),
  updateSmtpConfig: (payload: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    pass?: string;
    fromName?: string;
  }) => api.put<{ config: any; message: string }>('/admin/smtp-config', payload),
  testSmtpEmail: (toEmail: string) =>
    api.post<{
      config: any;
      delivery: {
        sent: boolean;
        channel: string;
        hostUsed?: string;
        previewUrl?: string;
        error?: string;
        timestamp: string;
      };
      logs: any[];
      message: string;
    }>('/admin/smtp-test', { toEmail }),
};

export const healthApi = {
  check: () => api.get('/health'),
  ready: () => api.get('/health/ready'),
};
