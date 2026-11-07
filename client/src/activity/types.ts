export const MONEY_SERIES = [
  { key: 'invoiced', label: 'CA facturé HT', color: '#2378B5' },
  { key: 'performed', label: 'Interventions effectuées HT', color: '#238675' },
  { key: 'quoted', label: 'Devis émis HT', color: '#8064B1' },
  { key: 'accepted', label: 'Devis acceptés HT', color: '#AC782D' },
] as const;
export type MoneyKey = typeof MONEY_SERIES[number]['key'];
export type MetricKey = MoneyKey | 'interventions' | 'quotes';
export interface ActivityDay {
  date: string;
  invoiced: number | null;
  performed: number | null;
  quoted: number | null;
  accepted: number | null;
  interventions: number | null;
  quotes: number | null;
}
export interface ChartSeries { key: MetricKey; label: string; color: string }
export const VOLUME_SERIES: ChartSeries[] = [
  { key: 'interventions', label: 'Interventions effectuées', color: '#238675' },
  { key: 'quotes', label: 'Devis émis', color: '#8064B1' },
];
export type Granularity = 'day' | 'week' | 'month';
export interface ChartPoint extends ActivityDay { endDate: string; periodLabel: string }
export interface DashboardProps {
  days: ActivityDay[];
  issues?: string[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
}
export const METRIC_KEYS: MetricKey[] = ['invoiced','performed','quoted','accepted','interventions','quotes'];
