import { bearer } from '@elysiajs/bearer';
import { cors } from '@elysiajs/cors';
import { jwt } from '@elysiajs/jwt';
import { Elysia, t } from 'elysia';

import { readConfig, type ServerConfig } from './config';

export type CandidateProfile = {
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

const SEED_CANDIDATES: CandidateProfile[] = [
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

export function createApp(customConfig?: Partial<ServerConfig>) {
  const config = { ...readConfig(), ...customConfig };
  const swipesByTarget = new Map<string, 'solidarity' | 'pass'>();
  const waitlistEmails = new Set<string>();

  return new Elysia()
    .use(
      cors({
        origin: config.allowedWebOrigins.length > 0 ? config.allowedWebOrigins : true,
        credentials: true,
      })
    )
    .use(bearer())
    .use(
      jwt({
        name: 'jwt',
        secret: config.jwtPluginSecret,
      })
    )
    .get('/health', () => ({
      status: 'ok',
      service: 'comradia-server',
      runtime: {
        bunVersion: Bun.version,
      },
    }))
    .get('/discovery/feed', () => ({
      candidates: SEED_CANDIDATES.filter((c) => !swipesByTarget.has(c.id)),
    }))
    .post(
      '/discovery/swipe',
      ({ body }) => {
        swipesByTarget.set(body.targetId, body.direction);
        const matched = body.direction === 'solidarity';
        return {
          ok: true,
          targetId: body.targetId,
          direction: body.direction,
          matched,
        };
      },
      {
        body: t.Object({
          targetId: t.String({ minLength: 1 }),
          direction: t.Union([t.Literal('solidarity'), t.Literal('pass')]),
          note: t.Optional(t.String({ maxLength: 280 })),
        }),
      }
    )
    .post(
      '/early-access',
      ({ body, set }) => {
        const email = body.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          set.status = 400;
          return { error: { code: 'invalid_email', message: 'Valid email is required.' } };
        }
        waitlistEmails.add(email);
        set.status = 201;
        return { ok: true, email, count: waitlistEmails.size };
      },
      {
        body: t.Object({
          email: t.String(),
          city: t.Optional(t.String()),
          tendency: t.Optional(t.String()),
        }),
      }
    );
}
