import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const landingPage = readFileSync(new URL('./index.html', import.meta.url), 'utf8');

test('early access link leads to a coming-soon message', () => {
  assert.match(landingPage, /href="#early-access"[^>]*>Early access<\/a>/i);
  assert.match(landingPage, /id="early-access"[^>]*>Early access is coming soon\.<\//i);
});

test('the landing page does not take email signups while early access is closed', () => {
  assert.doesNotMatch(landingPage, /<form\b|<input\b/i);
});
