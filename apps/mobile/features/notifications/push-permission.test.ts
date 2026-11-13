import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { pushPermissionFrom } from './push-permission';

describe('pushPermissionFrom', () => {
  it('treats an Android 13+ never-asked permission as not-determined', () => {
    assert.equal(
      pushPermissionFrom({ granted: false, status: 'denied', canAskAgain: true }),
      'not-determined',
    );
  });

  it('keeps an Android permanently denied permission as denied', () => {
    assert.equal(
      pushPermissionFrom({ granted: false, status: 'denied', canAskAgain: false }),
      'denied',
    );
  });

  it('maps an Android granted permission to authorized', () => {
    assert.equal(
      pushPermissionFrom({ granted: true, status: 'granted', canAskAgain: true }),
      'authorized',
    );
  });

  it('maps an undetermined status to not-determined', () => {
    assert.equal(
      pushPermissionFrom({ granted: false, status: 'undetermined', canAskAgain: true }),
      'not-determined',
    );
  });

  it('maps iOS statuses from the expo-notifications enum', () => {
    const ios = (status: number, canAskAgain = true) => ({
      granted: false,
      status: 'denied',
      canAskAgain,
      ios: { status },
    });
    assert.equal(pushPermissionFrom({ ...ios(2), granted: true, status: 'granted' }), 'authorized');
    assert.equal(pushPermissionFrom(ios(3)), 'provisional');
    assert.equal(pushPermissionFrom(ios(4)), 'provisional');
    assert.equal(pushPermissionFrom(ios(0)), 'not-determined');
    assert.equal(pushPermissionFrom(ios(1)), 'denied');
  });

  it('keeps iOS denied as denied even when canAskAgain is true', () => {
    assert.equal(
      pushPermissionFrom({
        granted: false,
        status: 'denied',
        canAskAgain: true,
        ios: { status: 1 },
      }),
      'denied',
    );
  });
});
