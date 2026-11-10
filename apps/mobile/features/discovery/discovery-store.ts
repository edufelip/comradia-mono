import { create } from 'zustand';

export type ComradeProfile = {
  id: string;
  displayName: string;
  age: number;
  pronouns: string;
  city: string;
  tendency: string;
  causes: string[];
  bio: string;
  praxisPrompt: string;
  unionMember: boolean;
};

export const INITIAL_COMRADES: ComradeProfile[] = [
  {
    id: 'comrade-maya',
    displayName: 'Maya',
    age: 28,
    pronouns: 'she/her',
    city: 'São Paulo',
    tendency: 'Eco-Socialist',
    causes: ['Climate Justice', 'Transit For All', 'Tenant Union'],
    bio: 'Urban planner by day, community garden organizer by weekend. Looking for someone to bike with and debate degrowth over espresso.',
    praxisPrompt: 'Ideal first date: solidarity kitchen prep then live samba at a cooperative bar.',
    unionMember: true,
  },
  {
    id: 'comrade-lucas',
    displayName: 'Lucas',
    age: 31,
    pronouns: 'he/him',
    city: 'Florianópolis',
    tendency: 'Democratic Socialist',
    causes: ['Labor Rights', 'Public Education', 'Free Software'],
    bio: 'Public school history teacher & teachers union steward. Big fan of sci-fi, Ursula K. Le Guin, and beach hikes.',
    praxisPrompt: 'Ask me about my homemade sourdough starter named Rosa Luxemburg.',
    unionMember: true,
  },
  {
    id: 'comrade-val',
    displayName: 'Val',
    age: 26,
    pronouns: 'they/them',
    city: 'Rio de Janeiro',
    tendency: 'Anarcho-Syndicalist',
    causes: ['Mutual Aid', 'Queer Liberation', 'Zine Libraries'],
    bio: 'Riso printer, dog fosterer, and neighborhood mutual-aid coordinator. Swipe left (in a good way) if you love punk shows and feijoada.',
    praxisPrompt: 'Together we could seize the means of weekend brunch.',
    unionMember: false,
  },
];

type DiscoveryState = {
  candidates: ComradeProfile[];
  matches: ComradeProfile[];
  sendSolidarity: (id: string) => void;
  passCandidate: (id: string) => void;
  resetDeck: () => void;
};

export const useDiscoveryStore = create<DiscoveryState>((set) => ({
  candidates: INITIAL_COMRADES,
  matches: [],
  sendSolidarity: (id) =>
    set((state) => {
      const target = state.candidates.find((c) => c.id === id);
      if (!target) return state;
      const alreadyMatched = state.matches.some((m) => m.id === id);
      return {
        candidates: state.candidates.filter((c) => c.id !== id),
        matches: alreadyMatched ? state.matches : [target, ...state.matches],
      };
    }),
  passCandidate: (id) =>
    set((state) => ({
      candidates: state.candidates.filter((c) => c.id !== id),
    })),
  resetDeck: () =>
    set({
      candidates: INITIAL_COMRADES,
    }),
}));
