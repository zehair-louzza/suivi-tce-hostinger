import { LayoutDashboard, CalendarRange, FileText, Wrench, Map, Receipt, BarChart3, Building2, SlidersHorizontal, ShieldCheck, Smartphone } from 'lucide-react';

export const NAV = [
  {
    group: 'Espace de travail',
    items: [
      { id: 'tableau-de-bord', label: 'Tableau de bord', short: 'Pilotage', icon: LayoutDashboard, badge: 3 },
      { id: 'planning', label: 'Planning', short: 'Planning', icon: CalendarRange, badge: 3 },
      { id: 'devis', label: 'Devis', short: 'Devis', icon: FileText, badge: 8 },
      { id: 'interventions', label: 'Interventions', short: 'Travaux', icon: Wrench, badge: 12 },
      { id: 'carte', label: 'Carte & tournées', short: 'Carte', icon: Map },
    ],
  },
  {
    group: 'Gestion',
    items: [
      { id: 'facturation', label: 'Facturation', short: 'Factures', icon: Receipt, badge: 2, urgent: true },
      { id: 'comptabilite', label: 'Comptabilité & équipe', short: 'Compta', icon: BarChart3 },
      { id: 'donneurs-ordre', label: 'Donneurs d’ordre', short: 'Clients', icon: Building2 },
    ],
  },
  {
    group: 'Administration',
    items: [
      { id: 'parametres', label: 'Paramètres métier', short: 'Réglages', icon: SlidersHorizontal },
      { id: 'utilisateurs', label: 'Utilisateurs & accès', short: 'Accès', icon: ShieldCheck, badge: 1, urgent: true },
    ],
  },
  {
    group: 'Terrain',
    items: [{ id: 'terrain', label: 'App technicien', short: 'Terrain', icon: Smartphone }],
  },
];

export const NAV_ITEMS = NAV.flatMap((g) => g.items);
export const NAV_BY_ID = Object.fromEntries(NAV_ITEMS.map((i) => [i.id, i]));
export const MOBILE_PRIMARY = ['tableau-de-bord', 'planning', 'devis', 'interventions'];
