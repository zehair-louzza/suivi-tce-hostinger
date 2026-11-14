// Éditeur de dossier photographique réutilisable (Interventions et Visites Devis) avec compression JPEG auto.
import { useRef, useState } from 'react';
import { Camera, Plus, Trash2, ZoomIn } from 'lucide-react';
import toast from 'react-hot-toast';
import { compressAndOptimizeImage, MAX_PHOTOS_PER_MISSION } from '../lib/imageOptimizer';
import type { TerrainPhoto } from '../lib/api';

type CategoriePhoto = NonNullable<TerrainPhoto['category']>;

const CATEGORIES_PHOTO: Array<{ value: CategoriePhoto; label: string }> = [
  { value: 'AVANT', label: 'Avant travaux' },
  { value: 'APRES', label: 'Après travaux' },
  { value: 'CONSTAT', label: 'Constat terrain' },
  { value: 'RELEVE_CHIFFRAGE', label: 'Relevé chiffrage / Visite' },
];

type Props = {
  titre: string;
  sousTitre?: string;
  photos: TerrainPhoto[];
  auteur?: string;
  categorieDefaut?: CategoriePhoto;
  disabled?: boolean;
  onChange: (photos: TerrainPhoto[]) => void | Promise<void>;
  onCommit?: (photos: TerrainPhoto[]) => void | Promise<void>;
  onOpenLightbox: (photos: TerrainPhoto[], index: number) => void;
};

export function PhotoDossierEditor({
  titre,
  sousTitre = 'Stockage optimisé (~50 Ko / photo) • Intégrées automatiquement au PDF client',
  photos,
  auteur = '',
  categorieDefaut = 'CONSTAT',
  disabled = false,
  onChange,
  onCommit,
  onOpenLightbox,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [categorieAjout, setCategorieAjout] = useState<CategoriePhoto>(categorieDefaut);
  const [enCours, setEnCours] = useState(false);

  const ajouterFichiers = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const restantes = MAX_PHOTOS_PER_MISSION - photos.length;
    if (restantes <= 0) {
      toast.error(`Maximum ${MAX_PHOTOS_PER_MISSION} photos atteint pour ce dossier.`);
      return;
    }
    const aTraiter = Array.from(files).slice(0, restantes);
    if (files.length > restantes) {
      toast(`Limite de ${MAX_PHOTOS_PER_MISSION} photos : seules les ${restantes} premières ont été ajoutées.`);
    }

    setEnCours(true);
    try {
      const ajoutees: TerrainPhoto[] = [];
      const libCat = CATEGORIES_PHOTO.find((c) => c.value === categorieAjout)?.label || categorieAjout;
      for (const f of aTraiter) {
        if (!f.type.startsWith('image/')) continue;
        const opt = await compressAndOptimizeImage(f);
        const legendeAuto = f.name.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' ').slice(0, 80);
        ajoutees.push({
          id: `ph-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          url: opt.dataUrl,
          category: categorieAjout,
          caption: legendeAuto || libCat,
          takenAt: new Date().toISOString(),
          auteur,
        });
      }
      if (ajoutees.length > 0) {
        const next = [...photos, ...ajoutees];
        onChange(next);
        if (onCommit) await onCommit(next);
        toast.success(`${ajoutees.length} photo${ajoutees.length > 1 ? 's ajoutées' : ' ajoutée'} au dossier`);
      }
    } catch (err: any) {
      toast.error(err?.message || "Impossible d'optimiser cette photo");
    } finally {
      setEnCours(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const majPhoto = (idx: number, patch: Partial<TerrainPhoto>) => {
    const next = photos.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    onChange(next);
  };

  const supprimerPhoto = async (idx: number) => {
    const next = photos.filter((_, i) => i !== idx);
    onChange(next);
    if (onCommit) await onCommit(next);
  };

  return (
    <div
      style={{
        padding: '12px',
        borderRadius: '10px',
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <div style={{ fontSize: '12px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Camera size={14} /> {titre} ({photos.length}/{MAX_PHOTOS_PER_MISSION})
          </div>
          <div style={{ fontSize: '10.5px', color: '#0284c7', fontWeight: 500 }}>{sousTitre}</div>
        </div>

        {!disabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <select
              className="select"
              style={{ height: '30px', fontSize: '11px', padding: '0 8px', width: 'auto' }}
              value={categorieAjout}
              onChange={(e) => setCategorieAjout(e.target.value as CategoriePhoto)}
              aria-label="Catégorie des photos ajoutées"
            >
              {CATEGORIES_PHOTO.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: 'none' }}
              onChange={(e) => ajouterFichiers(e.target.files)}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={enCours || photos.length >= MAX_PHOTOS_PER_MISSION}
              onClick={() => inputRef.current?.click()}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
            >
              <Plus size={13} /> {enCours ? 'Compression...' : 'Ajouter des photos'}
            </button>
          </div>
        )}
      </div>

      {photos.length > 0 ? (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
            gap: '10px',
          }}
        >
          {photos.map((ph, idx) => (
            <div
              key={ph.id || idx}
              style={{
                borderRadius: '8px',
                overflow: 'hidden',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
                boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
              }}
            >
              <div
                onClick={() => onOpenLightbox(photos, idx)}
                style={{ position: 'relative', cursor: 'pointer', height: '94px', background: '#0f172a' }}
                title="Agrandir la photo"
              >
                <img src={ph.url} alt={ph.caption || 'Photo'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <span
                  style={{
                    position: 'absolute',
                    right: 6,
                    bottom: 6,
                    background: 'rgba(15, 23, 42, 0.72)',
                    color: '#fff',
                    borderRadius: 6,
                    padding: '3px 5px',
                    display: 'inline-flex',
                    alignItems: 'center',
                  }}
                >
                  <ZoomIn size={12} />
                </span>
              </div>
              <div style={{ padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                  <select
                    className="select"
                    disabled={disabled}
                    value={ph.category || 'CONSTAT'}
                    onChange={(e) => majPhoto(idx, { category: e.target.value as CategoriePhoto })}
                    style={{ fontSize: '10px', fontWeight: 700, color: '#0284c7', height: '24px', padding: '0 4px', flex: 1 }}
                  >
                    {CATEGORIES_PHOTO.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  {!disabled && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => supprimerPhoto(idx)}
                      title="Retirer cette photo"
                      style={{ padding: '2px 5px', color: '#dc2626', minWidth: 'auto' }}
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  className="input"
                  disabled={disabled}
                  value={ph.caption || ''}
                  onChange={(e) => majPhoto(idx, { caption: e.target.value })}
                  placeholder="Légende..."
                  style={{ fontSize: '10.5px', height: '24px', padding: '2px 6px' }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 0' }}>
          Aucune photo jointe pour le moment. Utilisez « Ajouter des photos » pour les joindre au rapport PDF.
        </div>
      )}
    </div>
  );
}
