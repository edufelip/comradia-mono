export const enUS = {
  'a11y.brand_logo': 'Comradia logo',
  'tabs.discover': 'Comrades',
  'tabs.matches': 'Solidarity',
  'tabs.profile': 'Praxis',
  'discover.title': 'Comradia',
  'discover.subtitle': 'Where solidarity meets romance',
  'discover.union_badge': 'Union Member',
  'discover.praxis_label': 'PRAXIS & FIRST DATE',
  'discover.action.pass': 'Pass',
  'discover.action.solidarity': 'Send Solidarity',
  'discover.empty.title': 'You caught up with the local collective',
  'discover.empty.body': 'Reset the deck to review comrades in your area again.',
  'discover.empty.reset': 'Reset Deck',
  'matches.title': 'Mutual Solidarity',
  'matches.subtitle': 'Comrades who matched with your values',
  'matches.empty': 'No matches yet — send solidarity on the Comrades tab to start a conversation.',
  'profile.title': 'Your Praxis Profile',
  'profile.subtitle': 'Shared values first, small talk second',
  'profile.tendency': 'Political Tendency',
  'profile.causes': 'Core Causes',
} as const;

export type TranslationKey = keyof typeof enUS;
