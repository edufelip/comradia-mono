import assert from 'node:assert/strict';
import { it } from 'node:test';
import { simulateRuleSet, type SimEvent } from '../src/gamification/admin/simulate.js';
import { seedRuleSet } from '../src/gamification/engine/ruleset-loader.js';

it('replays changed conditions even when the active rule would have rejected the event', () => {
  const current = seedRuleSet();
  const draft = structuredClone(current);
  const rule = draft.earnRules.find((rule) => rule.event === 'conversation.started');
  assert.ok(rule?.conditions);
  rule.conditions[0].value = 2;
  const activity = {
    id: 'episode', event: 'conversation.started', atMs: Date.parse('2026-11-25T12:00:00Z'),
    pairKey: 'salted-pair', actor: true, arm: 'treatment',
    facts: { 'conversation.messagesEach': 2, 'conversation.spanMinutes': 20, 'account.ageDays': 30 },
  } satisfies Omit<SimEvent, 'uid'>;
  const events = [{ ...activity, uid: 'first' }, { ...activity, uid: 'second', actor: false }];
  assert.equal(simulateRuleSet(current, events, 14).awards, 0);
  const result = simulateRuleSet(draft, [...events, ...events], 14);
  assert.equal(result.awards, 2);
  assert.equal(result.cravos, 60);
});

it('deduplicates two deliveries of the same source message like the award engine', () => {
  const activity: SimEvent = {
    id: 'delivery-one', uid: 'first', event: 'message.timely_reply',
    atMs: Date.parse('2026-11-25T12:00:00Z'), pairKey: null, actor: true, arm: 'treatment',
    facts: { 'reply.waitedHours': 1 }, sourceKey: 'same-message',
  };
  const result = simulateRuleSet(seedRuleSet(), [
    activity, { ...activity, id: 'delivery-two' },
    { ...activity, id: 'delivery-three', sourceKey: 'another-message' },
  ], 14);
  assert.equal(result.awards, 2);
});
