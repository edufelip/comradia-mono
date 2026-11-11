import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  ageOn,
  buildDocuments,
  canFinish,
  canLeaveValuesStep,
  canLeaveVibeStep,
  EMPTY_DRAFT,
  MAX_AGE,
  NAME_MAX,
  parseBirthDate,
  toggleValue,
  validateBasics,
  VALUE_IDS,
  type OnboardingDraft,
} from './profile-schema';

/** Fixed "today" so ages never depend on when the suite runs. */
const TODAY = new Date(Date.UTC(2026, 10, 11));

function draft(overrides: Partial<OnboardingDraft> = {}): OnboardingDraft {
  return { ...EMPTY_DRAFT, values: [], ...overrides };
}

const COMPLETE = draft({
  displayName: '  Rosa  ',
  birthDateInput: '14/03/1994',
  vibe: 'bookworm',
  lookingFor: 'everyone',
  values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
  promptId: 'green_flag',
  promptAnswer: '  You know your neighbours by name.  ',
});

describe('parseBirthDate', () => {
  it('turns a typed DD/MM/YYYY date into the stored ISO form', () => {
    assert.equal(parseBirthDate('14/03/1994'), '1994-03-14');
  });

  it('accepts 29 February in a leap year and rejects it in a common year', () => {
    assert.equal(parseBirthDate('29/02/2024'), '2024-02-29');
    assert.equal(parseBirthDate('29/02/2023'), null);
  });

  it('rejects a day the month does not have', () => {
    assert.equal(parseBirthDate('31/04/2024'), null);
    assert.equal(parseBirthDate('00/01/2000'), null);
  });

  it('rejects anything that is not exactly DD/MM/YYYY', () => {
    assert.equal(parseBirthDate('1994-03-14'), null);
    assert.equal(parseBirthDate('14/3/1994'), null);
    assert.equal(parseBirthDate('14/03/94'), null);
    assert.equal(parseBirthDate(''), null);
  });

  it('ignores surrounding whitespace', () => {
    assert.equal(parseBirthDate('  14/03/1994 '), '1994-03-14');
  });
});

describe('ageOn', () => {
  it('counts whole years on the day before, on and after the birthday', () => {
    assert.equal(ageOn('1994-03-14', new Date(Date.UTC(2026, 2, 13))), 31);
    assert.equal(ageOn('1994-03-14', new Date(Date.UTC(2026, 2, 14))), 32);
    assert.equal(ageOn('1994-03-14', new Date(Date.UTC(2026, 2, 15))), 32);
  });

  it('keeps 29 February birthdays young until 1 March in a common year', () => {
    assert.equal(ageOn('2000-02-29', new Date(Date.UTC(2026, 1, 28))), 25);
    assert.equal(ageOn('2000-02-29', new Date(Date.UTC(2026, 2, 1))), 26);
  });
});

describe('validateBasics', () => {
  it('requires a first name of at most 40 characters', () => {
    assert.equal(validateBasics(draft({ birthDateInput: '14/03/1994' }), TODAY), 'name_required');
    assert.equal(
      validateBasics(
        draft({ displayName: 'a'.repeat(NAME_MAX + 1), birthDateInput: '14/03/1994' }),
        TODAY,
      ),
      'name_required',
    );
    assert.equal(
      validateBasics(
        draft({ displayName: 'a'.repeat(NAME_MAX), birthDateInput: '14/03/1994' }),
        TODAY,
      ),
      null,
    );
  });

  it('requires a real calendar birthday', () => {
    assert.equal(validateBasics(draft({ displayName: 'Rosa' }), TODAY), 'birth_date_invalid');
    assert.equal(
      validateBasics(draft({ displayName: 'Rosa', birthDateInput: '31/04/2000' }), TODAY),
      'birth_date_invalid',
    );
  });

  it('accepts someone who turns 18 today and refuses someone one day short', () => {
    assert.equal(
      validateBasics(draft({ displayName: 'Rosa', birthDateInput: '11/11/2008' }), TODAY),
      null,
    );
    assert.equal(
      validateBasics(draft({ displayName: 'Rosa', birthDateInput: '12/11/2008' }), TODAY),
      'too_young',
    );
  });

  it('refuses an implausible age above the stored maximum', () => {
    assert.equal(
      validateBasics(draft({ displayName: 'Rosa', birthDateInput: '11/11/1926' }), TODAY),
      'too_old',
    );
    assert.equal(
      validateBasics(draft({ displayName: 'Rosa', birthDateInput: '11/11/1927' }), TODAY),
      null,
    );
    assert.equal(
      validateBasics(
        draft({ displayName: 'Rosa', birthDateInput: '11/11/1927' }),
        new Date(Date.UTC(2027, 10, 11)),
      ),
      'too_old',
    );
    assert.equal(MAX_AGE, 99);
  });
});

describe('canLeaveVibeStep', () => {
  it('is true only when basics, vibe and looking-for are done', () => {
    assert.equal(canLeaveVibeStep(COMPLETE, TODAY), true);
    assert.equal(canLeaveVibeStep(draft({ ...COMPLETE, vibe: null }), TODAY), false);
    assert.equal(canLeaveVibeStep(draft({ ...COMPLETE, lookingFor: null }), TODAY), false);
    assert.equal(canLeaveVibeStep(draft({ ...COMPLETE, displayName: '' }), TODAY), false);
  });

  it('requires a union when the badge is on, and ignores it when off', () => {
    assert.equal(
      canLeaveVibeStep(draft({ ...COMPLETE, unionMember: true, union: null }), TODAY),
      false,
    );
    assert.equal(
      canLeaveVibeStep(draft({ ...COMPLETE, unionMember: true, union: 'apeoesp' }), TODAY),
      true,
    );
    assert.equal(
      canLeaveVibeStep(draft({ ...COMPLETE, unionMember: false, union: 'apeoesp' }), TODAY),
      true,
    );
  });
});

describe('canLeaveValuesStep', () => {
  it('needs three and allows at most five', () => {
    assert.equal(canLeaveValuesStep(draft({ values: VALUE_IDS.slice(0, 2) })), false);
    assert.equal(canLeaveValuesStep(draft({ values: VALUE_IDS.slice(0, 3) })), true);
    assert.equal(canLeaveValuesStep(draft({ values: VALUE_IDS.slice(0, 5) })), true);
  });
});

describe('canFinish', () => {
  it('needs a non-blank answer of at most 280 characters', () => {
    assert.equal(canFinish(draft({ promptAnswer: '' })), false);
    assert.equal(canFinish(draft({ promptAnswer: '   ' })), false);
    assert.equal(canFinish(draft({ promptAnswer: 'a'.repeat(280) })), true);
    assert.equal(canFinish(draft({ promptAnswer: 'a'.repeat(281) })), false);
  });
});

describe('toggleValue', () => {
  it('adds in order and removes the same id', () => {
    const withOne = toggleValue([], 'cycling');
    assert.deepEqual(withOne, ['cycling']);
    assert.deepEqual(toggleValue(withOne, 'cycling'), []);
  });

  it('returns a new array instead of mutating the one it was given', () => {
    const values = ['cycling'] as const;
    const next = toggleValue([...values], 'tenant_rights');
    assert.notEqual(next, values);
    assert.deepEqual(values, ['cycling']);
  });

  it('never grows past five and reopens a slot when one is removed', () => {
    const full = VALUE_IDS.slice(0, 5);
    assert.deepEqual(toggleValue([...full], VALUE_IDS[5]), full);
    assert.deepEqual(toggleValue([...full], VALUE_IDS[0]), full.slice(1));
  });
});

describe('buildDocuments', () => {
  it('builds the public profile and the private account from a finished draft', () => {
    assert.deepEqual(buildDocuments(COMPLETE, TODAY), {
      profile: {
        displayName: 'Rosa',
        age: 32,
        vibe: 'bookworm',
        lookingFor: 'everyone',
        unionMember: false,
        union: null,
        values: ['bookshops_coffee', 'tenant_rights', 'cycling'],
        promptId: 'green_flag',
        promptAnswer: 'You know your neighbours by name.',
      },
      account: { birthDate: '1994-03-14', sharedPassionWeight: 60 },
    });
  });

  it('keeps the chosen union only for members', () => {
    assert.equal(
      buildDocuments(draft({ ...COMPLETE, unionMember: true, union: 'apeoesp' }), TODAY).profile
        .union,
      'apeoesp',
    );
    assert.equal(
      buildDocuments(draft({ ...COMPLETE, unionMember: false, union: 'apeoesp' }), TODAY).profile
        .union,
      null,
    );
  });

  it('clamps the shared-passion weight into 0–100', () => {
    assert.equal(
      buildDocuments(draft({ ...COMPLETE, sharedPassionWeight: 150 }), TODAY).account
        .sharedPassionWeight,
      100,
    );
    assert.equal(
      buildDocuments(draft({ ...COMPLETE, sharedPassionWeight: -20 }), TODAY).account
        .sharedPassionWeight,
      0,
    );
  });

  it('throws instead of writing a half-finished profile', () => {
    assert.throws(() => buildDocuments(draft({ ...COMPLETE, vibe: null }), TODAY));
    assert.throws(() => buildDocuments(draft({ ...COMPLETE, values: [] }), TODAY));
    assert.throws(() => buildDocuments(draft({ ...COMPLETE, promptAnswer: ' ' }), TODAY));
  });
});
