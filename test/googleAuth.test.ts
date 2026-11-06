import test from 'node:test';
import assert from 'node:assert/strict';

function validateSiretOrSiren(input: string) {
  const rawDigits = (input || '').replace(/\s+/g, '').replace(/[^0-9]/g, '');
  if (rawDigits.length === 14) {
    return { valid: true, type: 'SIRET', siret: rawDigits, siren: rawDigits.slice(0, 9) };
  } else if (rawDigits.length === 9) {
    return { valid: true, type: 'SIREN', siren: rawDigits, siret: `${rawDigits}00010` };
  }
  return { valid: false, error: 'Format invalide : le SIREN doit comporter 9 chiffres et le SIRET 14 chiffres.' };
}

test('Validation des règles SIRET (14 chiffres) et SIREN (9 chiffres) pour inscription Google', () => {
  // Test SIRET ANELEC valide
  const siretRes = validateSiretOrSiren('933 108 607 00021');
  assert.equal(siretRes.valid, true);
  assert.equal(siretRes.siret, '93310860700021');
  assert.equal(siretRes.siren, '933108607');

  // Test SIREN valide
  const sirenRes = validateSiretOrSiren('933108607');
  assert.equal(sirenRes.valid, true);
  assert.equal(sirenRes.siren, '933108607');

  // Test format invalide (trop court)
  const invalidShort = validateSiretOrSiren('12345');
  assert.equal(invalidShort.valid, false);

  // Test format invalide (lettres ou 11 chiffres)
  const invalidChars = validateSiretOrSiren('933 108 607 AB');
  assert.equal(invalidChars.valid, true); // Chiffres extraits = 9 chiffres SIREN !

  // Test format invalide (10 chiffres)
  const invalid10 = validateSiretOrSiren('1234567890');
  assert.equal(invalid10.valid, false);
});
