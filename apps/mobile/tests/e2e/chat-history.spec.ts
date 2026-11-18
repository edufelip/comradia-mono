import { expect, test } from '@playwright/test';

import { seedLike, seedMessage, signUpWithPhone, uidForPhone } from './support/firebase';
import { completeOnboarding } from './support/onboarding';

const docs = 'http://127.0.0.1:8089/v1/projects/demo-comradia/databases/(default)/documents';
const jsonHeaders = { Authorization: 'Bearer owner', 'Content-Type': 'application/json' };

test('loading earlier history preserves the current chat position', async ({ page }) => {
  const phone = await signUpWithPhone(page);
  const uid = await uidForPhone(phone);
  await completeOnboarding(page, { name: `Rosa ${phone.slice(-8)}` });

  const other = 'seed-maya';
  const users = [uid, other].sort();
  const matchId = users.join('_');
  await Promise.all([seedLike(other, uid), seedLike(uid, other)]);
  const timestamp = Date.now();
  const match = await fetch(`${docs}/matches/${matchId}`, {
    method: 'PATCH',
    headers: jsonHeaders,
    body: JSON.stringify({
      fields: {
        users: { arrayValue: { values: users.map((stringValue) => ({ stringValue })) } },
        createdAt: { timestampValue: new Date(timestamp).toISOString() },
      },
    }),
  });
  expect(match.ok).toBe(true);
  const writes = Array.from({ length: 201 }, (_, index) => ({
    update: {
      name: `projects/demo-comradia/databases/(default)/documents/matches/${matchId}/messages/history-${index}`,
      fields: {
        from: { stringValue: other },
        text: { stringValue: `History message ${index}` },
        createdAt: { timestampValue: new Date(timestamp + index).toISOString() },
      },
    },
  }));
  const messages = await fetch(`${docs}:commit`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ writes }),
  });
  expect(messages.ok).toBe(true);

  await page.getByRole('tab', { name: /Matches/ }).click();
  await page.getByTestId(`match-row-${matchId}`).click();
  const oldest = page.getByTestId('chat-message-history-0');
  const anchor = page.getByTestId('chat-message-history-1');
  const newest = page.getByTestId('chat-message-history-200');
  await expect(newest).toBeInViewport();
  await expect(oldest).toHaveCount(0);
  await page.getByTestId('chat-messages').evaluate((view) => view.scrollTo(0, 0));
  await expect(anchor).toBeInViewport();

  await page.getByTestId('chat-load-earlier').click();
  await expect(oldest).toBeVisible();
  await expect(anchor).toBeInViewport();
  await expect(newest).not.toBeInViewport();

  // The live query replaces one single-line message with another at its page limit.
  const viewport = page.getByTestId('chat-messages');
  const height = await viewport.evaluate((view) => view.scrollHeight);
  await seedMessage(matchId, other, 'A new message');
  await expect(anchor).toHaveCount(0);
  await expect.poll(() => viewport.evaluate((view) => view.scrollHeight)).toBe(height);
  await expect(page.getByText('A new message')).toBeInViewport();
});
