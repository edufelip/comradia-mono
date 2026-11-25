import assert from 'node:assert/strict';
import { it } from 'node:test';
import { ratingReviewUrl, shouldShowRatingBanner } from './eligibility';

const day = 86_400_000;
const ready = {
  now: 30 * day,
  state: { lastShownAt: 16 * day, ratedTapAt: null },
  firstSignInAt: 23 * day,
  matchCount: 1,
  sessionHadCelebration: false,
  platform: 'ios' as const,
};

it('applies each platform, match, age and cooldown boundary', () => {
  assert.equal(shouldShowRatingBanner(ready), true);
  assert.equal(shouldShowRatingBanner({ ...ready, platform: 'android' }), true);
  assert.equal(shouldShowRatingBanner({ ...ready, platform: 'web' }), false);
  assert.equal(shouldShowRatingBanner({ ...ready, firstSignInAt: ready.firstSignInAt + 1 }), false);
  assert.equal(shouldShowRatingBanner({ ...ready, matchCount: 0 }), false);
  assert.equal(shouldShowRatingBanner({ ...ready, sessionHadCelebration: true }), false);
  assert.equal(
    shouldShowRatingBanner({ ...ready, state: { ...ready.state, ratedTapAt: 1 } }),
    false,
  );
  assert.equal(
    shouldShowRatingBanner({ ...ready, state: { ...ready.state, lastShownAt: 16 * day + 1 } }),
    false,
  );
});

it('allows configured listings only from the platform stores', () => {
  assert.equal(
    ratingReviewUrl('ios', 'https://apps.apple.com/br/app/comradia/id1234'),
    'https://apps.apple.com/br/app/comradia/id1234?action=write-review',
  );
  assert.equal(
    ratingReviewUrl('android', 'https://play.google.com/store/apps/details?id=com.example'),
    'https://play.google.com/store/apps/details?id=com.example',
  );
  assert.equal(ratingReviewUrl('ios', 'https://unrelated.example'), null);
  assert.equal(ratingReviewUrl('web', 'https://apps.apple.com/br/app/comradia/id1234'), null);
});
