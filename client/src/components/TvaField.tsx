// Taux de TVA d'une pièce (devis ou intervention).
//
// Le taux est présélectionné selon le type de client — autoliquidation 0 % pour un
// professionnel, 10 % pour un particulier — mais la personne qui saisit garde la main :
// menu déroulant ou valeur tapée librement. Le taux retenu est enregistré sur la pièce,
// pour que la facturation ne dépende plus d'une règle implicite.
import { useState } from 'react';
import type { ClientProfile } from '../lib/api';

const norm = (s: unknown) => String(s ?? '').replace(/\s+/g, ' ').trim().toUpperCase();

/** Présélection métier : 0 % (autoliquidation) pour un professionnel, 10 % pour un particulier. */
export function tvaParDefaut(clientName: string | null | undefined, profiles: ClientProfile[]): number {
  const p = profiles.find((c) => norm(c.nom) === norm(clientName));
  return p?.type === 'PARTICULIER' ? 10 : 0;
}

const CHOIX: { val: number; label: string }[] = [
  { val: 0, label: 'Autoliquidation — 0 %' },
  { val: 5.5, label: '5,5 % (rénovation énergétique)' },
  { val: 10, label: '10 % (rénovation > 2 ans)' },
  { val: 20, label: '20 % (standard)' },
];

export function TvaField({
  value,
  clientName,
  clientProfiles,
  onChange,
}: {
  /** Taux stocké sur la pièce ; null ou undefined = pas encore choisi */
  value: number | null | undefined;
  clientName: string | null | undefined;
  clientProfiles: ClientProfile[];
  onChange: (taux: number) => void;
}) {
  const parDefaut = tvaParDefaut(clientName, clientProfiles);
  const effectif = value ?? parDefaut;
  const estStandard = CHOIX.some((c) => c.val === effectif);
  const [libre, setLibre] = useState(!estStandard);

  return (
    <div>
      <label style={{ fontSize: '11.5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
        TVA{value == null ? ' (présélection selon le client)' : ''}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        <select
          className="select"
          style={{ flex: 1 }}
          value={libre ? 'libre' : String(effectif)}
          onChange={(e) => {
            if (e.target.value === 'libre') {
              setLibre(true);
              return;
            }
            setLibre(false);
            onChange(Number(e.target.value));
          }}
          data-testid="tva-select"
        >
          {CHOIX.map((c) => (
            <option key={c.val} value={String(c.val)}>
              {c.label}
              {c.val === parDefaut ? ' · présélection' : ''}
            </option>
          ))}
          <option value="libre">Autre taux…</option>
        </select>
        {libre && (
          <input
            type="number"
            className="input font-mono"
            style={{ width: 90 }}
            min={0}
            max={100}
            step={0.1}
            value={effectif}
            onChange={(e) => {
              const n = Number(e.target.value);
              if (!Number.isNaN(n)) onChange(Math.min(100, Math.max(0, n)));
            }}
            aria-label="Taux de TVA en pourcentage"
            data-testid="tva-libre"
          />
        )}
      </div>
    </div>
  );
}
