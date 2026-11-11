export const enUS = {
  'a11y.brand_logo': 'Comradia logo',
  'tabs.discover': 'Discover',
  'tabs.matches': 'Matches',
  'tabs.profile': 'Profile',
  'discover.title': 'Comradia',
  'discover.subtitle': 'Meet someone who gives a damn.',
  'discover.union_badge': 'Union Member',
  'discover.praxis_label': 'SHARED VALUES & FIRST DATE',
  'discover.action.pass': 'Pass',
  'discover.action.solidarity': 'Like',
  'discover.empty.title': 'You are all caught up',
  'discover.empty.body': 'Check back later or reset the deck to review people nearby again.',
  'discover.empty.reset': 'Reset Deck',
  'matches.title': 'Mutual Matches',
  'matches.subtitle': 'People who share what matters to you',
  'matches.empty': 'No matches yet — tap Like on Discover to start a conversation.',
  'profile.title': 'Your Profile',
  'profile.subtitle': 'Real chemistry. Shared values.',
  'profile.tendency': 'Core Values',
  'profile.causes': 'Passions & Causes',
} as const;

export type TranslationKey = keyof typeof enUS;
