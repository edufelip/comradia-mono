/** Shared timing and easing for purposeful, restrained interface motion. */
export const DS_MOTION = {
  duration: {
    fast: 120,
    standard: 220,
    slow: 360,
    /** A number counting up to its final value (reward amount, wallet balance). */
    countUp: 600,
    /** A one-shot celebration (confetti) after an achievement unlocks. */
    celebrate: 900,
  },
  easing: {
    easeOut: [0.16, 1, 0.3, 1],
  },
} as const;
