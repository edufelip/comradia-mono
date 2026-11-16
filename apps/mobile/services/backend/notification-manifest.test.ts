import assert from 'node:assert/strict';
import { it } from 'node:test';
import { applyNotificationColorOverride } from '../../app.config';

void it('preserves the Expo notification tint and marks only its FCM resource as the app override', () => {
  const color = {
    $: {
      'android:name': 'com.google.firebase.messaging.default_notification_color',
      'android:resource': '@color/notification_icon_color',
      'tools:replace': 'android:value',
    },
  };
  const other = { $: { 'android:name': 'unrelated', 'android:resource': '@color/other' } };
  const manifest: Parameters<typeof applyNotificationColorOverride>[0] = {
    manifest: {
      queries: [],
      $: { 'xmlns:android': 'http://schemas.android.com/apk/res/android', package: 'fixture' },
      application: [{ $: { 'android:name': '.MainApplication' }, 'meta-data': [color, other] }],
    },
  };
  applyNotificationColorOverride(manifest);
  applyNotificationColorOverride(manifest);
  assert.equal(color.$['android:resource'], '@color/notification_icon_color');
  assert.equal(color.$['tools:replace'], 'android:value,android:resource');
  assert.equal('tools:replace' in other.$, false);
  assert.equal(manifest.manifest.$['xmlns:tools'], 'http://schemas.android.com/tools');
});
