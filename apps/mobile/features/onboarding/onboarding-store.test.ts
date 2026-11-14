import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import {
  clampSharedPassionWeight,
  createEmptyDraft,
  formatBirthDateInput,
  useOnboardingStore,
} from './onboarding-store';

const state = () => useOnboardingStore.getState();

beforeEach(() => {
  useOnboardingStore.setState(createEmptyDraft());
});

describe('formatBirthDateInput', () => {
  it('adds the slashes as the digits arrive', () => {
    assert.equal(formatBirthDateInput('1'), '1');
    assert.equal(formatBirthDateInput('14'), '14');
    assert.equal(formatBirthDateInput('1403'), '14/03');
    assert.equal(formatBirthDateInput('14031994'), '14/03/1994');
  });

  it('drops everything that is not a digit, so pasted dates work', () => {
    assert.equal(formatBirthDateInput('14-03-1994'), '14/03/1994');
    assert.equal(formatBirthDateInput('14/03/1994'), '14/03/1994');
    assert.equal(formatBirthDateInput('abc'), '');
  });

  it('stops at eight digits', () => {
    assert.equal(formatBirthDateInput('1403199412345'), '14/03/1994');
  });
});

describe('onboarding draft store', () => {
  it('starts from the empty draft', () => {
    assert.equal(state().displayName, '');
    assert.equal(state().birthDateInput, '');
    assert.equal(state().vibe, null);
    assert.equal(state().lookingFor, null);
    assert.equal(state().unionMember, false);
    assert.equal(state().union, null);
    assert.deepEqual(state().values, []);
    assert.equal(state().sharedPassionWeight, 60);
    assert.equal(state().promptId, 'perfect_sunday');
    assert.equal(state().promptAnswer, '');
  });

  it('hands every new draft its own values array', () => {
    const first = createEmptyDraft();
    const second = createEmptyDraft();
    assert.notEqual(first.values, second.values);
  });

  it('keeps the name and the masked birthday', () => {
    state().setDisplayName('Rosa');
    state().setBirthDateInput('14031994');

    assert.equal(state().displayName, 'Rosa');
    assert.equal(state().birthDateInput, '14/03/1994');
  });

  it('stores the vibe and who the user is looking for', () => {
    state().setVibe('bookworm');
    state().setLookingFor('everyone');

    assert.equal(state().vibe, 'bookworm');
    assert.equal(state().lookingFor, 'everyone');
  });

  it('forgets the union when the badge is turned off', () => {
    state().setUnionMember(true);
    state().setUnion('apeoesp');
    assert.equal(state().union, 'apeoesp');

    state().setUnionMember(false);
    assert.equal(state().unionMember, false);
    assert.equal(state().union, null);

    state().setUnionMember(true);
    assert.equal(state().union, null);
  });

  it('adds values up to five and removes them again', () => {
    for (const id of [
      'climate_outdoors',
      'public_transit',
      'bookshops_coffee',
      'indie_film_music',
      'community_gardens',
    ] as const) {
      state().toggleValue(id);
    }
    assert.equal(state().values.length, 5);

    state().toggleValue('volunteering');
    assert.equal(state().values.length, 5);

    state().toggleValue('public_transit');
    assert.equal(state().values.length, 4);

    state().toggleValue('volunteering');
    assert.deepEqual(state().values, [
      'climate_outdoors',
      'bookshops_coffee',
      'indie_film_music',
      'community_gardens',
      'volunteering',
    ]);
  });

  it('clamps the shared-passion weight into 0–100', () => {
    state().setSharedPassionWeight(70);
    assert.equal(state().sharedPassionWeight, 70);

    state().setSharedPassionWeight(150);
    assert.equal(state().sharedPassionWeight, 100);

    state().setSharedPassionWeight(-10);
    assert.equal(state().sharedPassionWeight, 0);

    assert.equal(clampSharedPassionWeight(55.6), 56);
  });

  it('keeps the prompt and never stores more than 280 characters', () => {
    state().setPromptId('green_flag');
    state().setPromptAnswer('a'.repeat(300));

    assert.equal(state().promptId, 'green_flag');
    assert.equal(state().promptAnswer.length, 280);
  });

  it('sets and clears the photo uri', () => {
    assert.equal(state().photoUri, null);

    state().setPhotoUri('file:///tmp/me.jpg');
    assert.equal(state().photoUri, 'file:///tmp/me.jpg');

    state().setPhotoUri(null);
    assert.equal(state().photoUri, null);
  });

  it('stores the sensitive-data consent and starts without it', () => {
    assert.equal(state().sensitiveDataConsent, false);

    state().setSensitiveDataConsent(true);
    assert.equal(state().sensitiveDataConsent, true);

    state().setSensitiveDataConsent(false);
    assert.equal(state().sensitiveDataConsent, false);
  });

  it('resets to the empty draft and stays usable afterwards', () => {
    state().setDisplayName('Rosa');
    state().setVibe('foodie');
    state().setPromptAnswer('Feira.');
    state().setPhotoUri('file:///tmp/me.jpg');

    state().reset();

    assert.equal(state().displayName, '');
    assert.equal(state().photoUri, null);
    assert.equal(state().vibe, null);
    assert.deepEqual(state().values, []);
    assert.equal(state().promptAnswer, '');

    state().setDisplayName('Ana');
    assert.equal(state().displayName, 'Ana');
  });
});
