import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  forgetReconciliationForSession,
  markReconciliationForSession,
  resetReconciliationSession,
} from './reconcile-session';

describe('match reconciliation session guard', () => {
  it('allows one reconciliation per uid and tracks other uids separately', () => {
    resetReconciliationSession();
    assert.equal(markReconciliationForSession('alice'), true);
    assert.equal(markReconciliationForSession('alice'), false);
    assert.equal(markReconciliationForSession('bob'), true);
  });

  it('lets a uid try again after a failed reconciliation', () => {
    resetReconciliationSession();
    assert.equal(markReconciliationForSession('alice'), true);
    forgetReconciliationForSession('alice');
    assert.equal(markReconciliationForSession('alice'), true);
  });
});
