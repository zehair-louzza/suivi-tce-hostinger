// Automatisation B — fonctions pures du devis client (adresses, jeton, réponse, relances, PDF).
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  adressesDepuisFiche,
  contenuDevisModifie,
  choisirDestinataires,
  creneauRelanceClient,
  fabriquerJeton,
  genererSel,
  idDuJeton,
  prochaineActionDevis,
  statutApresReponse,
  trouverFiche,
  validerPdf,
  validerReponseClient,
  verifierJeton,
} from '../server/domain/devisClient.js';

// Novembre 2026 : heure d'hiver (Paris = UTC+1). Lundi 16 nov. 2026.
const paris = (jour: number, h: number, m = 0) => new Date(Date.UTC(2026, 10, jour, h - 1, m));

const FICHE = {
  nom: 'Groupe Atlas',
  email: 'contact@atlas.fr',
  active: true,
  services: [
    { nomService: 'Travaux', email: 'travaux@atlas.fr', recevoirDevis: true },
    { nomService: 'Compta', email: 'compta@atlas.fr', recevoirDevis: false },
    { nomService: 'Doublon', email: 'TRAVAUX@atlas.fr' },
    { nomService: 'Mal saisie', email: 'pas-une-adresse' },
  ],
};

test('fiche client : retrouvée par le nom (casse et espaces ignorés), jamais une fiche inactive', () => {
  assert.equal(trouverFiche([FICHE], '  groupe   ATLAS ')?.nom, 'Groupe Atlas');
  assert.equal(trouverFiche([{ ...FICHE, active: false }], 'Groupe Atlas'), null);
  assert.equal(trouverFiche([FICHE], 'Autre'), null);
  assert.equal(trouverFiche([FICHE], ''), null);
});

test('adresses : sans doublon ni adresse invalide, services « reçoit les devis » en premier', () => {
  const a = adressesDepuisFiche(FICHE);
  assert.deepEqual(a.map((x) => x.email), ['travaux@atlas.fr', 'compta@atlas.fr', 'contact@atlas.fr']);
  assert.equal(a[0].suggeree, true);
  assert.equal(a[1].suggeree, false);
  assert.deepEqual(adressesDepuisFiche(null), []);
});

test('destinataires : une seule adresse → envoi direct ; plusieurs → confirmation obligatoire ; seules les adresses de la fiche', () => {
  const une = adressesDepuisFiche({ nom: 'X', email: 'seul@x.fr' });
  assert.deepEqual(choisirDestinataires(une, undefined), { ok: true, emails: ['seul@x.fr'] });
  assert.deepEqual(choisirDestinataires(une, ['autre@pirate.fr']), { ok: true, emails: ['seul@x.fr'] }, "une seule adresse : on n'en accepte pas d'autre");

  const plusieurs = adressesDepuisFiche(FICHE);
  const rien = choisirDestinataires(plusieurs, []);
  assert.equal(rien.ok, false);
  assert.equal((rien as any).code, 'CONFIRMATION_REQUISE');
  assert.deepEqual(choisirDestinataires(plusieurs, ['Travaux@atlas.fr', 'travaux@atlas.fr']), { ok: true, emails: ['travaux@atlas.fr'] });
  const inconnue = choisirDestinataires(plusieurs, ['pirate@evil.com']);
  assert.equal((inconnue as any).code, 'ADRESSE_INCONNUE');
  const aucune = choisirDestinataires([], ['a@b.fr']);
  assert.equal((aucune as any).code, 'AUCUNE_ADRESSE');
});

test('jeton : valable pour son lien seulement (société, devis, sel), jamais deviné ni falsifié', () => {
  const lien = { id: 42, companyId: 1, devisId: 7, sel: genererSel() };
  const jeton = fabriquerJeton('secret-test', lien);
  assert.equal(idDuJeton(jeton), 42);
  assert.equal(verifierJeton('secret-test', jeton, lien), true);
  assert.equal(verifierJeton('autre-secret', jeton, lien), false);
  assert.equal(verifierJeton('secret-test', jeton, { ...lien, companyId: 2 }), false, 'lié à la société');
  assert.equal(verifierJeton('secret-test', jeton, { ...lien, devisId: 8 }), false, 'lié au devis');
  assert.equal(verifierJeton('secret-test', jeton, { ...lien, sel: genererSel() }), false, 'lié au sel');
  assert.equal(verifierJeton('secret-test', `43.${jeton.split('.')[1]}`, { ...lien, id: 43 }), false, 'signature d\'un autre lien');
  assert.equal(idDuJeton('abc'), null);
  assert.equal(idDuJeton("42.<script>"), null);
});

test('réponse du client : nom obligatoire, motif obligatoire pour un refus ou une modification', () => {
  assert.equal(validerReponseClient({ reponse: 'ACCEPTEE', nom: 'M. Durand' }).ok, true);
  assert.equal(validerReponseClient({ reponse: 'ACCEPTEE', nom: '' }).ok, false);
  assert.equal(validerReponseClient({ reponse: 'REFUSEE', nom: 'Durand', motif: '' }).ok, false);
  assert.equal(validerReponseClient({ reponse: 'MODIFICATION', nom: 'Durand', motif: 'ok' }).ok, false);
  const m = validerReponseClient({ reponse: 'MODIFICATION', nom: 'Durand', motif: 'Ajouter le remplacement du tableau' });
  assert.equal(m.ok, true);
  assert.equal(validerReponseClient({ reponse: 'PEUT-ETRE', nom: 'Durand' }).ok, false);
  assert.equal(statutApresReponse('ACCEPTEE'), 'Accepté');
  assert.equal(statutApresReponse('REFUSEE'), 'Refusé');
  assert.equal(statutApresReponse('MODIFICATION'), 'En négociation');
});

test('créneau des relances client : lundi–samedi, 8 h–19 h (Paris), jamais le dimanche ni la nuit', () => {
  assert.equal(creneauRelanceClient(paris(16, 10)), true);
  assert.equal(creneauRelanceClient(paris(16, 7, 59)), false);
  assert.equal(creneauRelanceClient(paris(16, 19)), false);
  assert.equal(creneauRelanceClient(paris(14, 10)), true, 'samedi matin');
  assert.equal(creneauRelanceClient(paris(15, 10)), false, 'dimanche');
});

test('relances : J+3 puis J+7 ; jamais deux fois ; rien après réponse ou révocation ; expiration à 30 jours', () => {
  const envoiLe = paris(9, 10); // lundi 9 nov.
  const expireLe = paris(9 + 30, 10);
  const base = { statut: 'Envoyé au client', envoiLe, expireLe, reponduOuRevoque: false, relanceJ3Le: null, relanceJ7Le: null };
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(11, 10) }), 'aucune', 'J+2');
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(12, 10) }), 'relancer_j3');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), maintenant: paris(13, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), maintenant: paris(16, 10) }), 'relancer_j7');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), relanceJ7Le: paris(16, 10), maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(16, 10) }), 'relancer_j7', 'J+7 atteint sans J+3 : on n\'envoie que J+7');
  assert.equal(prochaineActionDevis({ ...base, reponduOuRevoque: true, maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, statut: 'Accepté', maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, statut: 'À préparer', maintenant: paris(20, 10) }), 'aucune');
  assert.equal(prochaineActionDevis({ ...base, relanceJ3Le: paris(12, 10), relanceJ7Le: paris(16, 10), maintenant: paris(9 + 30, 10) }), 'expirer');
});

test('relances : pas la nuit ni le dimanche, mais l\'expiration passe toujours', () => {
  const envoiLe = paris(9, 10);
  const base = { statut: 'Envoyé au client', envoiLe, expireLe: paris(39, 10), reponduOuRevoque: false, relanceJ3Le: null, relanceJ7Le: null };
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(12, 22) }), 'aucune', 'nuit');
  assert.equal(prochaineActionDevis({ ...base, maintenant: paris(15, 10) }), 'aucune', 'dimanche');
  assert.equal(prochaineActionDevis({ ...base, expireLe: paris(15, 3), maintenant: paris(15, 4) }), 'expirer', 'expiration un dimanche à 4 h');
});

test('PDF : doit être un vrai PDF de 8 Mo maximum', () => {
  const pdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n%%EOF');
  const ok = validerPdf('Devis 2026/12.pdf', pdf.toString('base64'));
  assert.equal(ok.ok, true);
  assert.equal((ok as any).nom, 'Devis 2026_12.pdf');
  assert.equal(validerPdf('devis.exe', pdf.toString('base64')).ok, false);
  assert.equal(validerPdf('devis.pdf', Buffer.from('MZ pas un pdf').toString('base64')).ok, false);
  assert.equal(validerPdf('devis.pdf', '').ok, false);
  assert.equal(validerPdf('devis.pdf', Buffer.alloc(8 * 1024 * 1024 + 10, 65).toString('base64')).ok, false);
  assert.equal(validerPdf('devis.pdf', `data:application/pdf;base64,${pdf.toString('base64')}`).ok, true);
});

test('contenu du devis : seul ce que le client voit révoque le lien (pas les notes, ni un taux de TVA renseigné pour la première fois)', () => {
  const avant = { amount: 5000, montantHt: '5000', tauxTVA: null, objet: 'Rénovation', client: 'Atlas', siteAdresse: '3 rue Y', corpsEtat: 'Électricité', notes: 'a' };
  assert.equal(contenuDevisModifie(avant, { ...avant, notes: 'autre note', statutCommercial: 'X' }), false);
  assert.equal(contenuDevisModifie(avant, { ...avant, montantHt: '5000.00', amount: 5000.0 }), false, 'même montant, autre écriture');
  assert.equal(contenuDevisModifie(avant, { ...avant, tauxTVA: 20 }), false, 'taux renseigné pour la première fois');
  assert.equal(contenuDevisModifie({ ...avant, tauxTVA: 10 }, { ...avant, tauxTVA: 20 }), true, 'taux modifié');
  assert.equal(contenuDevisModifie(avant, { ...avant, montantHt: 6100 }), true);
  assert.equal(contenuDevisModifie(avant, { ...avant, objet: ' Rénovation  lourde ' }), true);
  assert.equal(contenuDevisModifie(avant, { ...avant, objet: ' Rénovation ' }), false, 'espaces ignorés');
});
