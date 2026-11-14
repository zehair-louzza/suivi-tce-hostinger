import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PLATFORM_CREATOR,
  isPlatformCreatorIdentity,
  normaliserTelephoneFr,
} from '../shared/types.js';
import { accessFor } from '../server/lib/access.js';
import { resolveCreatorAwarePhone } from '../server/lib/platformCreator.js';

test('normaliserTelephoneFr normalise les formats français vers E.164', () => {
  assert.equal(normaliserTelephoneFr('06 28 61 86 28'), '+33628618628');
  assert.equal(normaliserTelephoneFr('0628618628'), '+33628618628');
  assert.equal(normaliserTelephoneFr('0033 6.28.61.86.28'), '+33628618628');
  assert.equal(normaliserTelephoneFr('+33 6-28-61-86-28'), '+33628618628');
  assert.equal(normaliserTelephoneFr('33628618628'), '+33628618628');
  assert.equal(normaliserTelephoneFr(''), '');
  assert.equal(normaliserTelephoneFr(null), '');
});

test('isPlatformCreatorIdentity reconnaît le créateur par e-mail ou téléphone', () => {
  assert.equal(isPlatformCreatorIdentity({ email: PLATFORM_CREATOR.email }), true);
  assert.equal(isPlatformCreatorIdentity({ email: '  LOUZZA.ZEHAIR@GMAIL.COM ' }), true);
  assert.equal(isPlatformCreatorIdentity({ phone: '+33628618628' }), true);
  assert.equal(isPlatformCreatorIdentity({ phone: '06 28 61 86 28' }), true);
  assert.equal(isPlatformCreatorIdentity({ email: 'autre@entreprise.fr', phone: '+33600000000' }), false);
  assert.equal(isPlatformCreatorIdentity(null), false);
});

test('resolveCreatorAwarePhone force le téléphone canonique du créateur et préserve les autres', () => {
  assert.equal(resolveCreatorAwarePhone('louzza.zehair@gmail.com', undefined), '+33628618628');
  assert.equal(resolveCreatorAwarePhone('autre@societe.fr', '06 11 22 33 44'), '+33611223344');
  assert.equal(resolveCreatorAwarePhone('autre@societe.fr', null), null);
});

test('accessFor accorde le rôle admin créateur quel que soit son ID numérique', () => {
  const creatorAtId42 = accessFor({
    id: 42,
    email: 'louzza.zehair@gmail.com',
    phone: '+33628618628',
    role: 'ADMIN',
  });
  assert.equal(creatorAtId42.isAdmin, true);
  assert.equal(creatorAtId42.canSeeAmounts, true);

  // Un autre utilisateur ayant id=1 après réinitialisation mais sans statut ADMIN reste soumis au RBAC
  const nonCreatorId1Tech = accessFor({
    id: 1,
    email: 'tech@autre.fr',
    role: 'TECHNICIEN',
  });
  assert.equal(nonCreatorId1Tech.isAdmin, false);
  assert.equal(nonCreatorId1Tech.isFieldOnly, true);
});
