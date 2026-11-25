export type RatingState = { lastShownAt: number | null; ratedTapAt: number | null };
export type RatingPlatform = 'ios' | 'android' | 'web' | 'windows' | 'macos';
const DAY = 86_400_000;

export function shouldShowRatingBanner(input: {
  now: number;
  state: RatingState;
  firstSignInAt: number | null;
  matchCount: number;
  sessionHadCelebration: boolean;
  platform: RatingPlatform;
}): boolean {
  const { now, state, firstSignInAt, matchCount, sessionHadCelebration, platform } = input;
  return (
    (platform === 'ios' || platform === 'android') &&
    firstSignInAt !== null &&
    now - firstSignInAt >= 7 * DAY &&
    (state.lastShownAt === null || now - state.lastShownAt >= 14 * DAY) &&
    state.ratedTapAt === null &&
    matchCount > 0 &&
    !sessionHadCelebration
  );
}

export function ratingReviewUrl(
  platform: RatingPlatform,
  listing: string | undefined,
): string | null {
  if ((platform !== 'ios' && platform !== 'android') || listing === undefined) return null;
  try {
    const url = new URL(listing);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    if (platform === 'ios' && url.hostname === 'apps.apple.com' && /\/id\d+$/.test(url.pathname)) {
      url.searchParams.set('action', 'write-review');
      return url.href;
    }
    if (
      platform === 'android' &&
      url.hostname === 'play.google.com' &&
      url.pathname === '/store/apps/details' &&
      url.searchParams.has('id')
    )
      return url.href;
    return null;
  } catch {
    return null;
  }
}
