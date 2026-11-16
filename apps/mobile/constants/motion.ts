/** Shared timing and easing for purposeful, restrained interface motion. */
export const DS_MOTION = {
  duration: {
    fast: 120,
    standard: 220,
    slow: 360,
  },
  easing: {
    easeOut: [0.16, 1, 0.3, 1],
  },
} as const;
