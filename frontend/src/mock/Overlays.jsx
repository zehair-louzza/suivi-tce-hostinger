import React, { useMemo, useState, useEffect } from 'react';
import { Search, FileSpreadsheet, CalendarDays, Download, CornerDownLeft, Plus, FileText, Wrench, Mail, Paperclip, Send, ChevronDown, Image as ImageIcon, FileCheck2 } from 'lucide-react';
import { Modal, Btn, Checkbox, Field, Input, Pill, useMock, useToast, Menu, Segmented } from './ui';
import { SEARCH_INDEX, CLIENTS, CLIENT_BY_ID, TECH_BY_ID } from '../data/sample';

/* ---------------- Palette de commandes (Ctrl K) ---------------- */
export function CommandPalette({ open, onClose }) {
  const { go } = useMock();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const results = useMemo(() => {
    const base = [
      { kind: 'Action', ref: '+', label: 'Créer un devis', screen: 'devis', query: '?new=1' },
      { kind: 'Action', ref: '+', label: 'Créer une intervention', screen: 'interventions', query: '?new=1' },
      { kind: 'Action', ref: '→', label: 'Ouvrir le planning du jour', screen: 'planning' },
    ];
    const all = [...base, ...SEARCH_INDEX];
    const s = q.trim().toLowerCase();
    return (s ? all.filter((r) => `${r.ref} ${r.label} ${r.kind}`.toLowerCase().includes(s)) : all).slice(0, 9);
  }, [q]);
  useEffect(() => { setSel(0); }, [q]);
  useEffect(() => { if (!open) setQ(''); }, [open]);
  if (!open) return null;
  const pick = (r) => { onClose(); go(r.screen, r.query || ''); };
  return (
    <div className="m-overlay m-overlay--top" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="m-cmd" role="dialog" data-testid="mock-command-palette">
        <div className="m-cmd-input">
          <Search size={18} />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher un devis, une intervention, un client, une action…"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(results.length - 1, x + 1)); }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)); }
              if (e.key === 'Enter' && results[sel]) pick(results[sel]);
              if (e.key === 'Escape') onClose();
            }}
            data-testid="mock-command-input"
          />
          <kbd>Échap</kbd>
        </div>
        <div className="m-cmd-list">
          {results.map((r, i) => (
            <button key={r.kind + r.ref + r.label} type="button" className={`m-cmd-item ${i === sel ? 'is-sel' : ''}`} onMouseEnter={() => setSel(i)} onClick={() => pick(r)} data-testid={`mock-command-result-${i}`}>
              <span className="m-cmd-kind">{r.kind}</span>
              <span className="m-cmd-ref">{r.ref}</span>
              <span className="m-cmd-label">{r.label}</span>
              {i === sel && <CornerDownLeft size={14} />}
            </button>
          ))}
          {!results.length && <div className="m-empty">Aucun résultat pour « {q} »</div>}
        </div>
        <footer className="m-cmd-foot"><span>↑ ↓ pour naviguer</span><span>Entrée pour ouvrir</span></footer>
      </div>
    </div>
  );
}

/* ---------------- Bouton « Nouveau » unique ---------------- */
export function NewMenu({ label = 'Nouveau' }) {
  const { go } = useMock();
  return (
    <Menu
      align="right"
      testid="mock-new-menu"
      trigger={<button type="button" className="m-btn m-btn--primary m-btn--md"><Plus size={16} /><span>{label}</span><ChevronDown size={14} /></button>}
      items={[
        { label: 'Devis', icon: FileText, hint: 'D', onClick: () => go('devis', '?new=1'), testid: 'mock-new-devis' },
        { label: 'Intervention', icon: Wrench, hint: 'I', onClick: () => go('interventions', '?new=1'), testid: 'mock-new-intervention' },
      ]}
    />
  );
}

/* ---------------- Fenêtre Situation Excel ---------------- */
const PRESETS = [
  { id: 'today', label: 'Aujourd’hui', from: '06/11/2026', to: '06/11/2026' },
  { id: 'month', label: 'Ce mois-ci', from: '01/11/2026', to: '30/11/2026' },
  { id: 'year', label: 'Cette année', from: '01/01/2026', to: '31/12/2026' },
  { id: 'all', label: 'Toutes les dates', from: '—', to: '—' },
];
export function ExcelModal({ open, onClose }) {
  const toast = useToast();
  const [preset, setPreset] = useState('month');
  const [from, setFrom] = useState('01/11/2026');
  const [to, setTo] = useState('30/11/2026');
  const [content, setContent] = useState('complete');
  const [clients, setClients] = useState(() => CLIENTS.filter((c) => c.type === 'B2B').map((c) => c.id));
  const allOn = clients.length === CLIENTS.length;
  const toggle = (id) => setClients((l) => (l.includes(id) ? l.filter((x) => x !== id) : [...l, id]));
  const choose = (p) => { setPreset(p.id); setFrom(p.from); setTo(p.to); };
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={FileSpreadsheet}
      title="Situation Excel"
      subtitle="Exportez un classeur prêt à transmettre au client ou au cabinet comptable."
      width={640}
      testid="mock-excel-modal"
      footer={(
        <>
          <span className="m-muted m-small">{clients.length} donneur{clients.length > 1 ? 's' : ''} d’ordre · {content === 'complete' ? '3 onglets' : '1 onglet'}</span>
          <Btn variant="ghost" onClick={onClose} data-testid="mock-excel-cancel">Annuler</Btn>
          <Btn variant="primary" icon={Download} disabled={!clients.length} onClick={() => { onClose(); toast('Classeur « Situation_ANELEC_11-2026.xlsx » généré'); }} data-testid="mock-excel-export">Exporter en .xlsx</Btn>
        </>
      )}
    >
      <div className="m-form-sec">
        <span className="m-form-sec-title"><CalendarDays size={15} /> Période</span>
        <div className="m-chips">
          {PRESETS.map((p) => (
            <button key={p.id} type="button" className={`m-chip ${preset === p.id ? 'is-on' : ''}`} onClick={() => choose(p)} data-testid={`mock-excel-preset-${p.id}`}>{p.label}</button>
          ))}
        </div>
        <div className="m-grid-2">
          <Field label="Du"><Input value={from} onChange={(e) => { setFrom(e.target.value); setPreset(''); }} placeholder="JJ/MM/AAAA" data-testid="mock-excel-from" /></Field>
          <Field label="Au"><Input value={to} onChange={(e) => { setTo(e.target.value); setPreset(''); }} placeholder="JJ/MM/AAAA" data-testid="mock-excel-to" /></Field>
        </div>
      </div>
      <div className="m-form-sec">
        <span className="m-form-sec-title">Contenu</span>
        <Segmented
          testid="mock-excel-content"
          value={content}
          onChange={setContent}
          options={[{ id: 'complete', label: 'Situation complète' }, { id: 'interventions', label: 'Interventions' }, { id: 'devis', label: 'Devis' }]}
        />
      </div>
      <div className="m-form-sec">
        <div className="m-form-sec-row">
          <span className="m-form-sec-title">Donneurs d’ordre</span>
          <Checkbox checked={allOn} onChange={(v) => setClients(v ? CLIENTS.map((c) => c.id) : [])} label="Tous" testid="mock-excel-all" />
        </div>
        <div className="m-check-grid">
          {CLIENTS.map((c) => (
            <Checkbox key={c.id} checked={clients.includes(c.id)} onChange={() => toggle(c.id)} label={c.name} sub={c.type} testid={`mock-excel-client-${c.id}`} />
          ))}
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Fenêtre Envoi du rapport ---------------- */
export function EmailReportModal({ open, onClose, intervention }) {
  const toast = useToast();
  const it = intervention;
  const client = it ? CLIENT_BY_ID[it.client] : CLIENTS[0];
  const [to, setTo] = useState(() => client.emails.map((e) => e.email));
  const [photos, setPhotos] = useState(true);
  useEffect(() => { if (open) setTo(client.emails.map((e) => e.email)); }, [open, client]);
  if (!it) return null;
  const tech = TECH_BY_ID[it.tech];
  return (
    <Modal
      open={open}
      onClose={onClose}
      icon={Mail}
      title="Envoyer le rapport d’intervention"
      subtitle={`${it.ref} · ${client.name}`}
      width={620}
      testid="mock-report-modal"
      footer={(
        <>
          <span className="m-muted m-small">Réservé à l’équipe bureau</span>
          <Btn variant="ghost" onClick={onClose} data-testid="mock-report-cancel">Annuler</Btn>
          <Btn variant="primary" icon={Send} disabled={!to.length} onClick={() => { onClose(); toast(`Rapport ${it.ref} envoyé à ${to.length} destinataire${to.length > 1 ? 's' : ''}`); }} data-testid="mock-report-send">Envoyer le rapport</Btn>
        </>
      )}
    >
      <div className="m-form-sec">
        <span className="m-form-sec-title">Destinataires</span>
        <div className="m-check-grid m-check-grid--1">
          {client.emails.map((e) => (
            <Checkbox key={e.email} checked={to.includes(e.email)} onChange={() => setTo((l) => (l.includes(e.email) ? l.filter((x) => x !== e.email) : [...l, e.email]))} label={e.email} sub={e.label} testid={`mock-report-to-${e.label.toLowerCase()}`} />
          ))}
        </div>
      </div>
      <Field label="Objet"><Input defaultValue={`Rapport d’intervention ${it.ref} — ${it.objet}`} data-testid="mock-report-subject" /></Field>
      <Field label="Message">
        <textarea className="m-textarea" rows={4} defaultValue={`Bonjour,\n\nVeuillez trouver ci-joint le rapport de l’intervention ${it.ref} réalisée le ${it.date} par ${tech ? tech.name : 'notre technicien'} au ${it.addr}.\n\nCordialement,\nL’équipe ANELEC GROUPE`} data-testid="mock-report-message" />
      </Field>
      <div className="m-attach">
        <div className="m-attach-item"><FileCheck2 size={18} /><span><strong>Rapport_{it.ref}.pdf</strong><small>2 pages · 184 Ko</small></span><Pill tone="green">Prêt</Pill></div>
        <div className="m-attach-item"><ImageIcon size={18} /><span><strong>{it.photos} photos avant / après</strong><small>compressées · &lt; 75 Ko chacune</small></span><Checkbox checked={photos} onChange={setPhotos} label="Joindre" testid="mock-report-photos" /></div>
        <div className="m-attach-item m-attach-item--muted"><Paperclip size={18} /><span><strong>Bon d’intervention signé</strong><small>Ajouter un fichier</small></span></div>
      </div>
    </Modal>
  );
}

export function GoogleIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
