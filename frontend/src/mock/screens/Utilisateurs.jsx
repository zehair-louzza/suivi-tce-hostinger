import React, { useState } from 'react';
import { ShieldCheck, Mail, Users, Settings, Plus, MoreHorizontal, Clock, FileCheck2, Send, Edit3, Trash2, Shield, KeyRound, Clock4, Server, Check, X, Minus } from 'lucide-react';
import { useMock, useToast, Page, Tabs, Card, Btn, IconBtn, Pill, Avatar, StatusPill, DataTable, Menu, Modal, Field, Input, Dropdown, Switch } from '../ui';
import { USERS, MODULES, ROLE_RIGHTS, POINTAGES, WEEK, TECH_BY_ID, hhmm } from '../../data/sample';

const RIGHT_LABEL = { none: 'Aucun', view: 'Lecture', edit: 'Édition' };
const RIGHT_ICON = { none: <Minus size={13} />, view: <Check size={13} />, edit: <Check size={13} /> };
const RIGHT_TONE = { none: '#CBD5E1', view: '#2563EB', edit: '#16A34A' };

function NewUserModal({ open, onClose, onCreate }) {
  const [role, setRole] = useState('Bureau');
  const [email, setEmail] = useState('');
  const toast = useToast();
  return (
    <Modal open={open} onClose={onClose} icon={Users} title="Inviter un collaborateur" subtitle="Il recevra un e-mail avec un lien d’activation à usage unique." width={520} testid="mock-users-new-modal"
      footer={<><Btn variant="ghost" onClick={onClose} data-testid="mock-users-new-cancel">Annuler</Btn><Btn variant="primary" icon={Send} onClick={() => { onCreate({ email, role }); onClose(); toast(`Invitation envoyée à ${email}`); }} disabled={!email.includes('@')} data-testid="mock-users-new-create">Envoyer l’invitation</Btn></>}>
      <Field label="Nom et prénom" required><Input defaultValue="Lina Haddad" data-testid="mock-users-new-name" /></Field>
      <Field label="Adresse e-mail professionnelle" required><Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@anelecgroupe.com" data-testid="mock-users-new-email" /></Field>
      <Field label="Rôle" required hint="Les droits exacts peuvent être ajustés ensuite dans la matrice ci-dessous.">
        <Dropdown testid="mock-users-new-role" value={role} onChange={setRole} options={[{ id: 'Administrateur', label: 'Administrateur' }, { id: 'Direction', label: 'Direction' }, { id: 'Bureau', label: 'Bureau' }, { id: 'Technicien', label: 'Technicien' }]} />
      </Field>
    </Modal>
  );
}

function UtilisateursTab() {
  const toast = useToast();
  const [list, setList] = useState(USERS);
  const [open, setOpen] = useState(false);
  const create = (u) => setList((l) => [...l, { name: u.email.split('@')[0], email: u.email, role: u.role, tech: null, rights: u.role === 'Administrateur' ? 11 : 4, status: 'Invitation envoyée', last: '—' }]);
  return (
    <>
      <Card title="Collaborateurs" subtitle="Qui peut se connecter, avec quel rôle et quels droits." icon={Users} actions={<Btn variant="primary" icon={Plus} onClick={() => setOpen(true)} data-testid="mock-users-new">Inviter</Btn>} testid="mock-users-list">
        <DataTable
          testid="mock-users-table"
          columns={[
            { key: 'name', label: 'Collaborateur', render: (u) => <span className="m-cell-user"><Avatar name={u.name} size={24} /> <div className="m-cell-2"><strong>{u.name}</strong><span>{u.email}</span></div></span> },
            { key: 'role', label: 'Rôle', width: 140, render: (u) => <Pill tone={u.role === 'Administrateur' ? 'red' : u.role === 'Direction' ? 'purple' : u.role === 'Bureau' ? 'blue' : 'teal'}>{u.role}</Pill> },
            { key: 'tech', label: 'Fiche technicien', width: 140, render: (u) => (u.tech ? <span className="m-cell-user"><Avatar name={TECH_BY_ID[u.tech].name} initials={TECH_BY_ID[u.tech].initials} color={TECH_BY_ID[u.tech].color} size={20} /> {TECH_BY_ID[u.tech].name}</span> : <span className="m-muted m-small">—</span>) },
            { key: 'rights', label: 'Droits', width: 100, render: (u) => <span className="m-mono">{u.rights}/11</span> },
            { key: 'last', label: 'Dernière connexion', width: 170 },
            { key: 'status', label: 'Statut', width: 150, render: (u) => <StatusPill status={u.status} /> },
            {
              key: 'actions', label: '', align: 'right', width: 60, render: (u) => (
                <Menu testid={`mock-users-menu-${u.email}`} trigger={<IconBtn icon={MoreHorizontal} label="Plus" />} items={[
                  { label: 'Modifier le rôle', icon: Edit3, onClick: () => toast(`Rôle de ${u.name} modifié`) },
                  { label: 'Réinitialiser le mot de passe', icon: KeyRound, onClick: () => toast('Lien de réinitialisation envoyé') },
                  { sep: true },
                  { label: 'Désactiver le compte', icon: Trash2, danger: true, onClick: () => toast(`${u.name} désactivé`, 'warn') },
                ]} />
              ),
            },
          ]}
          rows={list}
          rowKey={(u) => u.email}
        />
      </Card>
      <NewUserModal open={open} onClose={() => setOpen(false)} onCreate={create} />
    </>
  );
}

function DroitsMatriceTab() {
  const roles = ['Administrateur', 'Direction', 'Bureau', 'Technicien'];
  return (
    <Card title="Matrice des droits par rôle" subtitle="Ce que chaque rôle peut lire ou modifier, module par module." icon={Shield} testid="mock-users-rights">
      <div className="m-table-wrap">
        <table className="m-table m-table--compact" data-testid="mock-users-rights-table">
          <thead>
            <tr>
              <th style={{ width: 200 }}>Module</th>
              {roles.map((r) => <th key={r} style={{ textAlign: 'center' }}>{r}</th>)}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m, i) => (
              <tr key={m}>
                <td><strong>{m}</strong></td>
                {roles.map((r) => {
                  const right = (ROLE_RIGHTS[r] || [])[i] || 'none';
                  return (
                    <td key={r} style={{ textAlign: 'center' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: RIGHT_TONE[right], fontSize: 12, fontWeight: 600 }}>{RIGHT_ICON[right]} {RIGHT_LABEL[right]}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function PointagesTab() {
  const toast = useToast();
  const totalH = WEEK.reduce((s, d) => s + d.h, 0);
  return (
    <>
      <Card title="Pointages du jour" subtitle="Arrivées confirmées par l’app terrain + position GPS." icon={Clock} testid="mock-users-pointages">
        <DataTable
          testid="mock-pointages-table"
          columns={[
            { key: 'tech', label: 'Technicien', render: (p) => <span className="m-cell-user"><Avatar name={TECH_BY_ID[p.tech].name} initials={TECH_BY_ID[p.tech].initials} color={TECH_BY_ID[p.tech].color} size={22} /> {TECH_BY_ID[p.tech].name}</span> },
            { key: 'in', label: 'Arrivée', width: 110, render: (p) => (p.in ? <span className="m-mono">{p.in}</span> : <span className="m-warn-text m-small">Non pointé</span>) },
            { key: 'out', label: 'Départ', width: 110, render: (p) => (p.out ? <span className="m-mono">{p.out}</span> : <span className="m-muted m-small">En cours</span>) },
            { key: 'missions', label: 'Missions', width: 100, render: (p) => <span className="m-mono">{p.missions}</span> },
            { key: 'state', label: 'Statut', width: 130, render: (p) => <Pill tone={p.state === 'ok' ? 'green' : p.state === 'late' ? 'amber' : 'red'}>{p.state === 'ok' ? 'Présent' : p.state === 'late' ? 'En retard' : 'Absent'}</Pill> },
            { key: 'actions', label: '', align: 'right', width: 150, render: (p) => (p.state === 'missing' ? <Btn size="sm" onClick={() => toast(`Rappel envoyé à ${TECH_BY_ID[p.tech].name}`, 'info')} data-testid={`mock-pointages-remind-${p.tech}`}>Relancer</Btn> : null) },
          ]}
          rows={POINTAGES}
          rowKey={(p) => p.tech}
        />
      </Card>
      <Card title="Semaine du 2 au 8 novembre" subtitle={`Total : ${totalH.toFixed(1)} h · Zéhair Louzza`} icon={Clock4} testid="mock-week-sheet">
        <div className="m-week" data-testid="mock-week-table">
          <div className="m-week-head"><span>Jour</span><span>Arrivée</span><span>Départ</span><span>Heures</span><span>Mission 1</span><span>Mission 2</span><span>Mission 3</span><span>Note</span></div>
          {WEEK.map((d) => (
            <div key={d.d} className="m-week-row">
              <strong>{d.d}</strong>
              <span className="m-mono">{d.in || '—'}</span>
              <span className="m-mono">{d.out || '—'}</span>
              <span className="m-mono">{d.h.toFixed(1)} h</span>
              <span className="m-mono m-small m-muted">{d.h > 0 ? 'INT' : '—'}</span>
              <span className="m-mono m-small m-muted">{d.h > 2 ? 'INT' : '—'}</span>
              <span className="m-mono m-small m-muted">{d.h > 6 ? 'INT' : '—'}</span>
              <span className="m-muted m-small">{d.in && !d.out ? 'En cours' : d.h > 0 ? 'OK' : ''}</span>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function RapportsTab() {
  const toast = useToast();
  const toValidate = [
    { ref: 'INT-2026-004', tech: 'jamal', client: 'EMALEC', objet: 'Peinture cage d’escalier', photos: 6, sent: '10:34' },
    { ref: 'INT-2026-012', tech: 'haitam', client: 'EMALEC', objet: 'Mise en conformité tableau', photos: 3, sent: '04/11 · 12:10', warn: 'Pièce manquante' },
  ];
  return (
    <Card title="Rapports à valider avant facturation" subtitle="Les techniciens ont envoyé ces comptes-rendus, validez-les avant émission de la facture." icon={FileCheck2} testid="mock-reports-review">
      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {toValidate.map((r) => (
          <li key={r.ref} style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto auto', gap: 12, alignItems: 'center', padding: '10px 2px', borderBottom: '1px dashed var(--border)' }}>
            <Avatar name={TECH_BY_ID[r.tech].name} initials={TECH_BY_ID[r.tech].initials} color={TECH_BY_ID[r.tech].color} size={28} />
            <div className="m-cell-2"><strong><span className="m-mono">{r.ref}</span> · {r.client}</strong><span>{r.objet} · {r.photos} photos · envoyé {r.sent}</span></div>
            {r.warn && <Pill tone="amber">{r.warn}</Pill>}
            <div style={{ display: 'flex', gap: 6 }}>
              <Btn size="sm" variant="ghost" onClick={() => toast(`Pièces complémentaires demandées à ${TECH_BY_ID[r.tech].name}`)} data-testid={`mock-report-review-return-${r.ref}`}>Retourner</Btn>
              <Btn size="sm" variant="primary" onClick={() => toast(`Rapport ${r.ref} validé — prêt à facturer`)} data-testid={`mock-report-review-validate-${r.ref}`}>Valider</Btn>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DiagnosticTab() {
  const [smtpOk, setSmtpOk] = useState(true);
  const toast = useToast();
  return (
    <Card title="Diagnostic e-mail (SMTP)" subtitle="Permet l’envoi automatique des rapports et des invitations." icon={Server} testid="mock-smtp">
      <div className="m-grid-2">
        <Field label="Serveur SMTP"><Input defaultValue="smtp.hostinger.com" data-testid="mock-smtp-host" /></Field>
        <Field label="Port + chiffrement"><Input defaultValue="465 · TLS" data-testid="mock-smtp-port" /></Field>
      </div>
      <div className="m-grid-2">
        <Field label="Expditeur"><Input defaultValue="ANELEC GROUPE &lt;no-reply@anelecgroupe.com&gt;" data-testid="mock-smtp-from" /></Field>
        <Field label="Répondre à"><Input defaultValue="travaux@anelecgroupe.com" data-testid="mock-smtp-reply" /></Field>
      </div>
      <div className="m-form-sec-row">
        <div><strong style={{ fontSize: 13.5 }}>Mode de test (envois simulés)</strong><p className="m-muted m-small" style={{ margin: 0 }}>Les e-mails ne sont pas envoyés réellement. Pratique pour la maquette ou une nouvelle entreprise.</p></div>
        <Switch testid="mock-smtp-test" checked={!smtpOk} onChange={(v) => setSmtpOk(!v)} />
      </div>
      <div className="m-callout" style={{ background: smtpOk ? 'color-mix(in srgb, var(--ok) 10%, white)' : 'color-mix(in srgb, var(--warn) 10%, white)', borderColor: smtpOk ? 'var(--ok)' : 'var(--warn)' }}>
        <strong>Dernier test</strong>
        <p style={{ margin: 0 }}>{smtpOk ? 'Connexion SMTP OK · e-mail de test reçu par admin@anelecgroupe.com (il y a 12 min).' : 'Mode simulé activé — aucun e-mail réel ne partira.'}</p>
      </div>
      <div><Btn icon={Mail} onClick={() => toast('E-mail de test envoyé')} data-testid="mock-smtp-test-send">Envoyer un e-mail de test</Btn></div>
    </Card>
  );
}

export default function Utilisateurs() {
  const [tab, setTab] = useState('users');
  return (
    <Page
      testid="mock-screen-utilisateurs"
      eyebrow="Console administrateur"
      title="Utilisateurs & accès"
      subtitle="Collaborateurs, droits, pointages, rapports terrain, apparence et diagnostic e-mail."
    >
      <Tabs
        testid="mock-utilisateurs-tabs"
        value={tab}
        onChange={setTab}
        items={[
          { id: 'users', label: 'Collaborateurs', count: USERS.length },
          { id: 'droits', label: 'Matrice des droits' },
          { id: 'pointages', label: 'Pointages', count: 6 },
          { id: 'rapports', label: 'Rapports à valider', count: 2 },
          { id: 'apparence', label: 'Apparence' },
          { id: 'smtp', label: 'Diagnostic e-mail' },
        ]}
      />
      {tab === 'users' && <UtilisateursTab />}
      {tab === 'droits' && <DroitsMatriceTab />}
      {tab === 'pointages' && <PointagesTab />}
      {tab === 'rapports' && <RapportsTab />}
      {tab === 'apparence' && <ApparenceTab />}
      {tab === 'smtp' && <DiagnosticTab />}
    </Page>
  );
}

function ApparenceTab() {
  const [defaultTheme, setDefaultTheme] = useState('atlas');
  const [allowOverride, setAllowOverride] = useState(true);
  const [preview, setPreview] = useState(null);
  const toast = useToast();

  const themes = [
    { id: 'light', name: 'ANELEC Original — Clair', tag: "L'apparence actuelle en mode clair.", dark: false, isOrig: true, sw: ['#047857', '#142536', '#f6f8fa', '#ffffff', '#b91c1c'] },
    { id: 'dark', name: 'ANELEC Original — Sombre', tag: "Mode sombre de l'apparence actuelle.", dark: true, isOrig: true, sw: ['#10b981', '#0a1017', '#0b111a', '#111a26', '#ef4444'] },
    { id: 'atlas', name: 'Atlas Clarity', tag: 'Entreprise moderne, bleu profond.', dark: false, sw: ['#1D4ED8', '#0EA5A4', '#0F172A', '#F6F7FB', '#F59E0B'] },
    { id: 'craft', name: 'Craft Warmth', tag: 'Chaleureux, arrondi, artisan.', dark: false, sw: ['#0F766E', '#D97706', '#22201C', '#FAF7F2', '#B91C1C'] },
    { id: 'signal', name: 'Signal Command', tag: 'Cockpit sombre, cyan vif.', dark: true, sw: ['#38BDF8', '#F59E0B', '#0B1220', '#13213A', '#34D399'] },
    { id: 'swiss', name: 'Editorial Swiss', tag: 'Grille suisse premium.', dark: false, sw: ['#0B3B8F', '#E07A5F', '#0B1220', '#FFFFFF', '#2A9D8F'] },
    { id: 'bento', name: 'Bento Modular', tag: 'Marque ANELEC, tuiles bento.', dark: false, sw: ['#111827', '#F5B400', '#EF5B4C', '#16A34A', '#F2F3F5'] },
  ];

  const current = preview || defaultTheme;

  return (
    <>
      <Card title="Apparence de la plateforme" subtitle="Choisissez l'apparence par défaut qui s'applique à toute l'entreprise. Vos collaborateurs peuvent personnaliser la leur si vous l'autorisez." icon={Settings} testid="mock-appearance-admin">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', fontSize: 13, flexWrap: 'wrap' }}>
          <span><span className="m-muted">Défaut actuel : </span><strong>{themes.find((t) => t.id === defaultTheme)?.name}</strong></span>
          <span style={{ flex: 1 }} />
          <Switch testid="mock-appearance-allow-override" checked={allowOverride} onChange={(v) => { setAllowOverride(v); toast(v ? 'Collaborateurs autorisés à personnaliser leur apparence.' : 'Personnalisation individuelle désactivée.'); }} />
          <span style={{ fontSize: 13 }}>Autoriser la personnalisation individuelle</span>
        </div>
      </Card>
      <Card title="Thèmes disponibles" subtitle={`${themes.length} apparences — survolez pour prévisualiser, cliquez pour appliquer à toute l'entreprise.`} icon={Shield} testid="mock-appearance-grid">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {themes.map((t) => {
            const isDefault = t.id === defaultTheme;
            const isCurrent = t.id === current;
            return (
              <button
                key={t.id}
                type="button"
                onMouseEnter={() => setPreview(t.id)}
                onMouseLeave={() => setPreview(null)}
                onClick={() => { setDefaultTheme(t.id); setPreview(null); toast(`Apparence « ${t.name} » appliquée à toute l'entreprise.`, 'success'); }}
                data-testid={`mock-appearance-theme-${t.id}`}
                style={{ all: 'unset', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 10, padding: 12, border: `2px solid ${isDefault ? 'var(--primary)' : 'var(--border)'}`, borderRadius: 'var(--radius-lg)', background: 'var(--surface)', boxShadow: isDefault ? '0 0 0 3px var(--primary-soft)' : 'var(--shadow-sm)' }}
              >
                <div aria-hidden="true" style={{ height: 94, borderRadius: 8, display: 'grid', gridTemplateColumns: '38px 1fr', overflow: 'hidden', background: t.dark ? '#0B1220' : '#F4F5F8', border: `1px solid ${t.dark ? '#23364F' : '#E5E7EB'}` }}>
                  <div style={{ background: t.sw[2], display: 'flex', flexDirection: 'column', padding: 5, gap: 3 }}>
                    <span style={{ height: 14, background: t.sw[0], borderRadius: 3 }} />
                    <span style={{ height: 5, background: 'rgba(255,255,255,.35)', borderRadius: 2 }} />
                    <span style={{ height: 5, background: 'rgba(255,255,255,.2)', borderRadius: 2 }} />
                    <span style={{ height: 5, background: 'rgba(255,255,255,.2)', borderRadius: 2 }} />
                  </div>
                  <div style={{ padding: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
                      {[0, 1, 2].map((i) => (
                        <div key={i} style={{ height: 24, background: t.dark ? '#13213A' : '#fff', border: `1px solid ${t.dark ? '#23364F' : '#E5E7EB'}`, borderRadius: 5, padding: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 2, background: t.sw[i % t.sw.length] }} />
                          <span style={{ width: '70%', height: 3, borderRadius: 1, background: t.dark ? '#2E4568' : '#CBD5E1' }} />
                        </div>
                      ))}
                    </div>
                    <div style={{ flex: 1, background: t.dark ? '#13213A' : '#fff', border: `1px solid ${t.dark ? '#23364F' : '#E5E7EB'}`, borderRadius: 5, padding: 4, display: 'flex', alignItems: 'flex-end' }}>
                      <svg viewBox="0 0 100 22" preserveAspectRatio="none" width="100%" height="22"><polyline points="0,18 15,16 30,13 45,9 60,7 75,4 90,5 100,2" fill="none" stroke={t.sw[0]} strokeWidth="1.8" /></svg>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {t.sw.map((c) => <span key={c} style={{ width: 14, height: 14, borderRadius: 3, background: c, border: '1px solid rgba(0,0,0,.08)' }} />)}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <strong style={{ fontSize: 13.5, color: 'var(--text-strong)' }}>{t.name}</strong>
                    {t.isOrig && <Pill tone="slate">Original</Pill>}
                    {t.dark && <Pill tone="indigo">Sombre</Pill>}
                  </div>
                  <span className="m-muted m-small">{t.tag}</span>
                </div>
                <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isDefault && <Pill tone="blue">★ Défaut entreprise</Pill>}
                  {isCurrent && !isDefault && <Pill tone="teal">Aperçu actif</Pill>}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
      <Card title="Mon apparence (côté utilisateur)" subtitle={allowOverride ? 'Aperçu de ce que chaque collaborateur verra sur son profil pour choisir son apparence personnelle.' : 'La personnalisation individuelle a été désactivée — les collaborateurs ne voient pas cet écran.'} icon={Users} testid="mock-appearance-personal-preview">
        {allowOverride ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
            {themes.map((t) => (
              <div key={t.id} style={{ padding: 10, borderRadius: 10, border: `2px solid ${t.id === defaultTheme ? 'var(--primary)' : 'var(--border)'}`, background: 'var(--surface)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 44, height: 32, borderRadius: 6, background: `linear-gradient(135deg, ${t.sw[0]} 0%, ${t.sw[2]} 100%)`, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <strong style={{ fontSize: 13, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</strong>
                  <span className="m-muted" style={{ fontSize: 11 }}>{t.dark ? 'Sombre' : 'Clair'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="m-callout m-callout--note">
            <strong>Désactivée par l'administrateur</strong>
            <p style={{ margin: 0 }}>Tous les collaborateurs utilisent le thème « {themes.find((t) => t.id === defaultTheme)?.name} » sans possibilité de le modifier.</p>
          </div>
        )}
      </Card>
    </>
  );
}
