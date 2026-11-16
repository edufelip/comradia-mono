import type { ValueId, Vibe } from '@/features/profile/profile-schema';

export const ONBOARDING_STEPS = 3;

type VibeVisual = { icon: string; color: string };

/**
 * Vibe cards carry an emoji and a colour (docs/comradia-screen-flow-chart.html,
 * the TEND constant). The colour tints the icon tile and the selected border;
 * the label and description come from localization.
 */
export const VIBE_VISUALS: Record<Vibe, VibeVisual> = {
  outdoorsy: { icon: '🌿', color: '#2F8F5B' },
  bookworm: { icon: '📚', color: '#B5523C' },
  creative: { icon: '🎨', color: '#D92D3A' },
  community: { icon: '🤝', color: '#8E1622' },
  foodie: { icon: '🍜', color: '#E05A47' },
};

/** Value chips keep the chart's emoji order (CAUSE_IC, in `VALUE_IDS` order). */
export const VALUE_ICONS: Record<ValueId, string> = {
  climate_outdoors: '🌿',
  public_transit: '🚋',
  bookshops_coffee: '☕',
  indie_film_music: '🎬',
  community_gardens: '🌱',
  tenant_rights: '🏠',
  food_markets: '🧺',
  cycling: '🚲',
  pets_parks: '🐕',
  volunteering: '🤲',
};
