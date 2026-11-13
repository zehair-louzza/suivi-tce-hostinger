// API client with axios + Full ANELEC types & endpoints
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import {
  Devis,
  Demande,
  DecisionDemande,
  TypeDemandeur,
  StatutDemande,
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
  CANAUX_RECEPTION,
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
  Demande,
  DecisionDemande,
  TypeDemandeur,
  StatutDemande,
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
  CANAUX_RECEPTION,
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
  timeout: 15000,
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

/** Demandes reçues : la file d'entrée, avant orientation en visite, devis ou intervention. */
export const demandeApi = {
  list: (params?: { search?: string; statut?: string; limit?: number }) =>
    api.get<{ data: Demande[]; total: number }>('/demandes', { params }),

  create: (data: Partial<Demande>) => api.post<{ data: Demande; message: string }>('/demandes', data),

  update: (id: number, data: Partial<Demande> & { motif?: string }) =>
    api.patch<{ data: Demande }>(`/demandes/${id}`, data),

  /** Oriente la demande : crée la visite, le devis ou l'intervention et les relie au dossier. */
  orienter: (id: number, decision: DecisionDemande) =>
    api.post<{
      data: Demande;
      created: { decision: DecisionDemande; devisId: number | null; interventionId: number | null; libelle: string };
    }>(`/demandes/${id}/orienter`, { decision }),
};

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

/** Entreprise telle que vue par le super administrateur (GET /admin/companies). */
export interface SuperAdminCompany {
  id: number;
  name: string;
  siren: string | null;
  active: boolean;
  siegeAdresse: string | null;
  siegeLat: number | null;
  siegeLng: number | null;
  defaultTheme: string;
  allowThemeOverride: boolean;
  accueilMaFile: boolean;
  userCount: number;
}

export interface CompanyInvitationItem {
  id: number;
  email: string;
  role: string;
  roleLabel: string;
  technicienNom: string | null;
  invitedByName: string | null;
  expiresAt: string;
  lastSentAt: string | null;
  acceptedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
  status: 'EN_ATTENTE' | 'ACCEPTEE' | 'REVOQUEE' | 'EXPIREE';
}

export interface InvitationSendResult {
  data: CompanyInvitationItem;
  emailSent: boolean;
  senderMode: 'COMPANY_MAILBOX' | 'PLATFORM' | null;
  fromAddress: string | null;
  inviteLink: string | null;
  deliveryError: string | null;
  message: string;
}

export interface MailConfigView {
  configured: boolean;
  enabled: boolean;
  ownMailbox: boolean;
  host: string;
  port: number;
  secure: boolean;
  user: string;
  fromName: string;
  replyTo: string;
  hasPassword: boolean;
  lastTestAt: string | null;
  lastTestOk: boolean | null;
  lastError: string | null;
  updatedAt?: string;
  mainEmail: string | null;
  companyName: string;
}

export const authApi = {
  getInvitation: (token: string) =>
    api.get<{
      email: string;
      companyName: string;
      role: string;
      roleLabel: string;
      invitedByName: string | null;
      expiresAt: string;
    }>(`/auth/invitations/${encodeURIComponent(token)}`),
  acceptInvitation: (payload: { token: string; name: string; password: string; acceptTerms: true }) =>
    api.post<{ user: User; accessToken: string; message: string }>('/auth/invitations/accept', payload),
  login: (email: string, password: string) => api.post('/auth/login', { email, password }),
  register: (name: string, email: string, password: string, companyName?: string, siretOrSiren?: string) =>
    api.post('/auth/register', { name, email, password, companyName, siretOrSiren }),
  resendConfirmation: (email: string) =>
    api.post<{
      message: string;
      emailSent?: boolean;
      alreadyConfirmed?: boolean;
      deliveryChannel?: string;
      previewUrl?: string | null;
      activationLink?: string | null;
    }>('/auth/resend-confirmation', { email }),
  verifyCode: (email: string, code: string) =>
    api.post<{
      success?: boolean;
      alreadyConfirmed?: boolean;
      message: string;
      user?: User;
      accessToken?: string;
    }>('/auth/verify-code', { email, code }),
  forgotPassword: (email: string) =>
    api.post<{
      message: string;
      emailSent?: boolean;
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
  getSmtpStatus: () => api.get<{ config: MailConfigView; logs: any[] }>('/admin/smtp-status'),
  updateSmtpConfig: (payload: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    pass?: string;
    fromName?: string;
    replyTo?: string;
    enabled?: boolean;
  }) => api.put<{ config: MailConfigView; message: string }>('/admin/smtp-config', payload),
  resetSmtpConfig: () => api.delete<{ config: MailConfigView; message: string }>('/admin/smtp-config'),
  testSmtpEmail: (toEmail: string) =>
    api.post<{
      config: MailConfigView;
      delivery: {
        sent: boolean;
        channel: string;
        senderMode?: 'COMPANY_MAILBOX' | 'PLATFORM';
        fromAddress?: string;
        hostUsed?: string;
        error?: string;
        timestamp: string;
      };
      logs: any[];
      message: string;
    }>('/admin/smtp-test', { toEmail }),
  listInvitations: () => api.get<{ data: CompanyInvitationItem[] }>('/admin/invitations'),
  createInvitation: (payload: {
    email: string;
    role: string;
    technicienNom?: string | null;
    permissions?: Partial<UserPermissions> | null;
  }) => api.post<InvitationSendResult>('/admin/invitations', payload),
  resendInvitation: (id: number) => api.post<InvitationSendResult>(`/admin/invitations/${id}/resend`),
  revokeInvitation: (id: number) => api.delete<{ message: string }>(`/admin/invitations/${id}`),
  /** Super administrateur : toutes les entreprises de la plateforme avec leurs réglages. */
  listCompanies: () =>
    api.get<{ data: SuperAdminCompany[]; availableThemes: string[] }>('/admin/companies'),
  /** Super administrateur : modifier les réglages d'apparence d'une entreprise donnée. */
  updateCompanyAppearance: (
    companyId: number,
    payload: { defaultTheme?: string; allowThemeOverride?: boolean; accueilMaFile?: boolean }
  ) => api.patch('/admin/appearance', { ...payload, companyId }),
  /** `companyId` n'est accepté que pour le super administrateur ; sinon c'est l'entreprise de l'appelant. */
  updateSiege: (payload: { siegeAdresse: string; siegeLat: number; siegeLng: number; companyId?: number }) =>
    api.patch<{
      companyId: number;
      companyName: string;
      siegeAdresse: string;
      siegeLat: number;
      siegeLng: number;
      message: string;
    }>('/admin/siege', payload),
};

export const healthApi = {
  check: () => api.get('/health'),
  ready: () => api.get('/health/ready'),
};
