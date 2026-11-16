import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reportAlertMessage, reportAlertRecipients } from '../src/report-alert-logic.js';

describe('report alert recipients', () => {
  it('lists the configured owners, trimmed and deduplicated', () => {
    assert.deepEqual(reportAlertRecipients([' owner-a ', 'owner-b', 'owner-a', ''], 'reporter'), ['owner-a', 'owner-b']);
  });

  it('never alerts the reporter, even when the reporter is listed', () => {
    assert.deepEqual(reportAlertRecipients(['reporter', 'owner'], 'reporter'), ['owner']);
  });

  it('returns nobody when the list is empty or only the reporter is listed', () => {
    assert.deepEqual(reportAlertRecipients([], 'reporter'), []);
    assert.deepEqual(reportAlertRecipients(['reporter'], 'reporter'), []);
  });
});

describe('report alert message', () => {
  it('shows only the fixed reason label and a report id in the data', () => {
    const message = reportAlertMessage('report-1', 'harassment');
    assert.equal(message.notification?.title, 'New report');
    assert.equal(message.notification?.body, 'Reason: harassment');
    assert.deepEqual(message.data, { type: 'report', reportId: 'report-1' });
    assert.equal(message.android?.notification?.channelId, 'matches-messages');
  });

  it('never echoes an unexpected reason value', () => {
    const message = reportAlertMessage('report-2', 'Free text that must not leak');
    assert.equal(message.notification?.body, 'Reason: unknown');
    assert.equal(JSON.stringify(message).includes('Free text'), false);
  });
});
