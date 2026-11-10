import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

export const profiles = pgTable('profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id').notNull().unique(),
  displayName: text('display_name').notNull(),
  age: integer('age').notNull(),
  pronouns: text('pronouns').notNull(),
  city: text('city').notNull(),
  tendency: text('tendency').notNull(), // e.g., 'Democratic Socialist', 'Eco-Socialist', 'Anarcho-Syndicalist', 'Social Democrat'
  causes: jsonb('causes').$type<string[]>().notNull().default([]),
  bio: text('bio').notNull(),
  praxisPrompt: text('praxis_prompt').notNull(),
  unionMember: boolean('union_member').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

export const swipes = pgTable(
  'swipes',
  {
    id: serial('id').primaryKey(),
    actorUserId: text('actor_user_id').notNull(),
    targetUserId: text('target_user_id').notNull(),
    direction: text('direction').$type<'solidarity' | 'pass'>().notNull(),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('swipes_actor_target_idx').on(table.actorUserId, table.targetUserId)]
);

export const matches = pgTable(
  'matches',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userAId: text('user_a_id').notNull(),
    userBId: text('user_b_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [uniqueIndex('matches_pair_idx').on(table.userAId, table.userBId)]
);

export const messages = pgTable('messages', {
  id: uuid('id').defaultRandom().primaryKey(),
  matchId: uuid('match_id').notNull(),
  senderUserId: text('sender_user_id').notNull(),
  body: text('body').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const earlyAccessSignups = pgTable('early_access_signups', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  city: text('city'),
  tendency: text('tendency'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
