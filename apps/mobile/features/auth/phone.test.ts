import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatBR, nationalDigits, toE164BR } from './phone';

describe('nationalDigits', () => {
  it('keeps the digits of a formatted national number', () => {
    assert.equal(nationalDigits('(11) 98765-4321'), '11987654321');
    assert.equal(nationalDigits('(11) 3456-7890'), '1134567890');
  });

  it('drops the country code from a 12- or 13-digit number', () => {
    assert.equal(nationalDigits('+55 11 98765-4321'), '11987654321');
    assert.equal(nationalDigits('551134567890'), '1134567890');
    assert.equal(nationalDigits('+5511987654321'), '11987654321');
  });

  it('keeps a 55 that is part of an 11-digit national number', () => {
    assert.equal(nationalDigits('55345678901'), '55345678901');
  });

  it('returns an empty string when there are no digits', () => {
    assert.equal(nationalDigits(''), '');
    assert.equal(nationalDigits('abc +()-'), '');
  });

  it('leaves impossible lengths alone', () => {
    assert.equal(nationalDigits('123'), '123');
    assert.equal(nationalDigits('+55 11 98765-4321 0'), '55119876543210');
  });
});

describe('toE164BR', () => {
  it('accepts an 11-digit mobile', () => {
    assert.equal(toE164BR('(11) 98765-4321'), '+5511987654321');
    assert.equal(toE164BR('11987654321'), '+5511987654321');
    assert.equal(toE164BR('+5511987654321'), '+5511987654321');
  });

  it('accepts a 10-digit landline', () => {
    assert.equal(toE164BR('(11) 3456-7890'), '+551134567890');
    assert.equal(toE164BR('+55 11 3456-7890'), '+551134567890');
  });

  it('rejects an 11-digit number whose ninth subscriber digit is not a 9', () => {
    assert.equal(toE164BR('11345678901'), null);
  });

  it('rejects a wrong length', () => {
    assert.equal(toE164BR(''), null);
    assert.equal(toE164BR('119876543'), null);
    assert.equal(toE164BR('119876543210'), null);
  });

  it('rejects an area code outside 11–99', () => {
    assert.equal(toE164BR('01987654321'), null);
    assert.equal(toE164BR('00987654321'), null);
  });
});

describe('formatBR', () => {
  it('formats a mobile with five digits before the dash', () => {
    assert.equal(formatBR('+5511987654321'), '(11) 98765-4321');
    assert.equal(formatBR('11987654321'), '(11) 98765-4321');
  });

  it('formats a landline with four digits before the dash', () => {
    assert.equal(formatBR('1134567890'), '(11) 3456-7890');
    assert.equal(formatBR('+551134567890'), '(11) 3456-7890');
  });

  it('formats partial input as the user types', () => {
    assert.equal(formatBR(''), '');
    assert.equal(formatBR('1'), '(1');
    assert.equal(formatBR('11'), '(11');
    assert.equal(formatBR('119'), '(11) 9');
    assert.equal(formatBR('1198765'), '(11) 98765');
    assert.equal(formatBR('11987654321'), '(11) 98765-4321');
    assert.equal(formatBR('1134'), '(11) 34');
  });

  it('ignores anything that is not a digit', () => {
    assert.equal(formatBR('(11) 98765-4321'), '(11) 98765-4321');
  });
});
