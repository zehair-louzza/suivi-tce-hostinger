// Shared types and validation schemas
import { z } from 'zod';

// Enums
export const StatutDevis = ['a-traiter', 'en-cours', 'en-attente', 'bloque', 'traite'] as const;
export const StatutIntervention = ['a-traiter', 'en-cours', 'en-attente', 'bloque', 'traite'] as const;

export type StatutDevisType = typeof StatutDevis[number];
export type StatutInterventionType = typeof StatutIntervention[number];

export const STATUT_LABELS: Record<StatutDevisType | StatutInterventionType, string> = {
  'a-traiter': 'À traiter',
  'en-cours': 'En cours',
  'en-attente': 'En attente',
  'bloque': 'Bloqué',
  'traite': 'Traité / Clôturé',
};

export const STATUT_COLORS: Record<StatutDevisType | StatutInterventionType, { bg: string; text: string }> = {
  'a-traiter': { bg: '#e5e7eb', text: '#374151' },
  'en-cours': { bg: '#dbeafe', text: '#1e40af' },
  'en-attente': { bg: '#fef3c7', text: '#92400e' },
  'bloque': { bg: '#fee2e2', text: '#991b1b' },
  'traite': { bg: '#dcfce7', text: '#166534' },
};

// Zod schemas
export const DevisSchema = z.object({
  id: z.number().int().positive().optional(),
  client: z.string().min(1, 'Client/Projet est requis').max(200),
  amount: z.number().nonnegative().default(0),
  dateCreated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  echeance: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)').optional().nullable(),
  status: z.enum(StatutDevis).default('a-traiter'),
  notes: z.string().max(2000).optional().nullable(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional(),
});

export const InterventionSchema = z.object({
  id: z.number().int().positive().optional(),
  chantier: z.string().min(1, 'Chantier/Lot est requis').max(200),
  entreprise: z.string().max(200).optional().nullable(),
  amount: z.number().nonnegative().default(0),
  datePlanifiee: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)'),
  dateReelle: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)').optional().nullable(),
  status: z.enum(StatutIntervention).default('a-traiter'),
  notes: z.string().max(2000).optional().nullable(),
  // Traçabilité conversion devis -> intervention
  origineDevisId: z.number().int().positive().optional().nullable(),
  origineDevisClient: z.string().max(200).optional().nullable(),
  origineDevisDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Format date invalide (YYYY-MM-DD)').optional().nullable(),
  createdAt: z.number().int().positive().optional(),
  updatedAt: z.number().int().positive().optional(),
});

// Input schemas
export const CreateDevisSchema = DevisSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const UpdateDevisSchema = CreateDevisSchema.partial();

export const CreateInterventionSchema = InterventionSchema.omit({ id: true, createdAt: true, updatedAt: true });
export const UpdateInterventionSchema = CreateInterventionSchema.partial();

export const ConvertDevisToInterventionSchema = z.object({
  devisId: z.number().int().positive(),
  entreprise: z.string().max(200).optional().nullable(),
  datePlanifiee: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

// Query params
export const ListQuerySchema = z.object({
  search: z.string().optional(),
  status: z.enum([...StatutDevis, ...StatutIntervention] as [string, ...string[]]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Auth
export const UserSchema = z.object({
  id: z.number().int().positive(),
  email: z.string().email(),
  name: z.string().min(1).max(100),
  role: z.enum(['admin', 'user', 'viewer']).default('user'),
  createdAt: z.number().int().positive(),
});

export const LoginSchema = z.object({
  email: z.string().email('Email invalide'),
  password: z.string().min(8, 'Mot de passe trop court (min 8 caractères)'),
});

export const RegisterSchema = LoginSchema.extend({
  name: z.string().min(1, 'Nom requis').max(100),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Les mots de passe ne correspondent pas',
  path: ['confirmPassword'],
});

// Token payload
export const TokenPayloadSchema = z.object({
  userId: z.number().int().positive(),
  email: z.string().email(),
  role: z.enum(['admin', 'user', 'viewer']),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

// Types
export type Devis = z.infer<typeof DevisSchema>;
export type Intervention = z.infer<typeof InterventionSchema>;
export type CreateDevis = z.infer<typeof CreateDevisSchema>;
export type UpdateDevis = z.infer<typeof UpdateDevisSchema>;
export type CreateIntervention = z.infer<typeof CreateInterventionSchema>;
export type UpdateIntervention = z.infer<typeof UpdateInterventionSchema>;
export type ConvertDevisToIntervention = z.infer<typeof ConvertDevisToInterventionSchema>;
export type ListQuery = z.infer<typeof ListQuerySchema>;
export type User = z.infer<typeof UserSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type TokenPayload = z.infer<typeof TokenPayloadSchema>;

// Helpers
export function formatDateFR(iso: string | null | undefined): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

export function formatCurrency(n: number): string {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', minimumFractionDigits: 0 }).format(n);
}

export function getStatutLabel(statut: StatutDevisType | StatutInterventionType): string {
  return STATUT_LABELS[statut] || statut;
}

export function getStatutColors(statut: StatutDevisType | StatutInterventionType): { bg: string; text: string } {
  return STATUT_COLORS[statut] || { bg: '#e5e7eb', text: '#374151' };
}