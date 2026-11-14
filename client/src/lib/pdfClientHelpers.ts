// Helpers partagés côté client pour la prévisualisation, le dépôt et l'envoi de PDF (Devis & Rapports).

export function lireFichierBase64(f: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').split(',')[1] || '');
    r.onerror = () => reject(new Error('Fichier illisible'));
    r.readAsDataURL(f);
  });
}

export function ouvrirPdfBlob(blob: Blob): void {
  const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export const formatDatePdfFr = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—';

export const formatDateHeurePdfFr = (iso?: string | null): string =>
  iso ? new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

export const formatTaillePdf = (o: number): string =>
  o > 1024 * 1024 ? `${(o / 1024 / 1024).toFixed(1)} Mo` : `${Math.max(1, Math.round(o / 1024))} Ko`;
