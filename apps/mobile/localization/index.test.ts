import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { resolveLocale, t } from './core';

describe('Comradia localization', () => {
  it('resolves supported locales and translates keys', () => {
    assert.equal(resolveLocale('pt-BR'), 'pt-BR');
    assert.equal(resolveLocale('es-AR'), 'es-ES');
    assert.equal(resolveLocale('en-GB'), 'en-US');
    assert.equal(t('en-US', 'discover.title'), 'Comradia');
    assert.equal(t('pt-BR', 'tabs.discover'), 'Descobrir');
  });
});
