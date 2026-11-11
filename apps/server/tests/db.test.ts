import { describe, expect, it } from 'bun:test';
import type { PgTable } from 'drizzle-orm/pg-core';
import { getTableConfig } from 'drizzle-orm/pg-core';

import { createDatabase } from '../src/db/client';
import * as schema from '../src/db/schema';
import {
  earlyAccessSignups,
  matches,
  messages,
  profiles,
  swipes,
} from '../src/db/schema';

const TABLES = [
  earlyAccessSignups,
  matches,
  messages,
  profiles,
  swipes,
] satisfies PgTable[];

function columnNames(table: PgTable): string[] {
  return getTableConfig(table).columns.map((column) => column.name);
}

function notNullNames(table: PgTable): string[] {
  return getTableConfig(table)
    .columns.filter((column) => column.notNull)
    .map((column) => column.name)
    .sort();
}

function defaultNames(table: PgTable): string[] {
  return getTableConfig(table)
    .columns.filter((column) => column.hasDefault)
    .map((column) => column.name)
    .sort();
}

function uniqueColumnNames(table: PgTable): string[] {
  return getTableConfig(table)
    .columns.filter((column) => column.isUnique)
    .map((column) => column.name)
    .sort();
}

describe('database schema', () => {
  it('declares exactly the five expected tables', () => {
    const tableNames = TABLES.map((table) => getTableConfig(table).name).sort();

    expect(tableNames).toEqual([
      'early_access_signups',
      'matches',
      'messages',
      'profiles',
      'swipes',
    ]);
    expect(Object.keys(schema).sort()).toEqual([
      'earlyAccessSignups',
      'matches',
      'messages',
      'profiles',
      'swipes',
    ]);
  });

  it('keeps the profiles columns and their nullability', () => {
    expect(columnNames(profiles)).toEqual([
      'id',
      'user_id',
      'display_name',
      'age',
      'pronouns',
      'city',
      'tendency',
      'causes',
      'bio',
      'praxis_prompt',
      'union_member',
      'created_at',
      'updated_at',
    ]);
    expect(notNullNames(profiles)).toEqual([
      'age',
      'bio',
      'causes',
      'city',
      'created_at',
      'display_name',
      'id',
      'praxis_prompt',
      'pronouns',
      'tendency',
      'union_member',
      'updated_at',
      'user_id',
    ]);
    expect(defaultNames(profiles)).toEqual([
      'causes',
      'created_at',
      'id',
      'union_member',
      'updated_at',
    ]);
    expect(uniqueColumnNames(profiles)).toEqual(['user_id']);
  });

  it('keeps the swipes columns and the actor/target unique index', () => {
    expect(columnNames(swipes)).toEqual([
      'id',
      'actor_user_id',
      'target_user_id',
      'direction',
      'note',
      'created_at',
    ]);
    expect(notNullNames(swipes)).toEqual([
      'actor_user_id',
      'created_at',
      'direction',
      'id',
      'target_user_id',
    ]);

    const indexes = getTableConfig(swipes).indexes;
    expect(indexes.map((index) => index.config.name)).toEqual(['swipes_actor_target_idx']);
    expect(indexes[0]?.config.unique).toBe(true);
  });

  it('keeps the matches columns and the pair unique index', () => {
    expect(columnNames(matches)).toEqual(['id', 'user_a_id', 'user_b_id', 'created_at']);

    const indexes = getTableConfig(matches).indexes;
    expect(indexes.map((index) => index.config.name)).toEqual(['matches_pair_idx']);
    expect(indexes[0]?.config.unique).toBe(true);
  });

  it('keeps the messages columns', () => {
    expect(columnNames(messages)).toEqual([
      'id',
      'match_id',
      'sender_user_id',
      'body',
      'created_at',
    ]);
    expect(notNullNames(messages)).toEqual([
      'body',
      'created_at',
      'id',
      'match_id',
      'sender_user_id',
    ]);
  });

  it('keeps early access signups unique by email with optional city and tendency', () => {
    expect(columnNames(earlyAccessSignups)).toEqual([
      'id',
      'email',
      'city',
      'tendency',
      'created_at',
    ]);
    expect(uniqueColumnNames(earlyAccessSignups)).toEqual(['email']);
    expect(notNullNames(earlyAccessSignups)).toEqual(['created_at', 'email', 'id']);
  });
});

describe('database client factory', () => {
  it('exposes a drizzle handle and a close function', () => {
    const handle = createDatabase('postgres://user:pass@127.0.0.1:1/comradia_none');

    expect(handle.db).toBeDefined();
    expect(handle.client).toBeDefined();
    expect(typeof handle.close).toBe('function');
  });

  it('does not open a connection until a query runs', async () => {
    // Port 1 is closed: an eager connection would throw ECONNREFUSED here.
    const handle = createDatabase('postgres://user:pass@127.0.0.1:1/comradia_none', { max: 1 });

    await expect(handle.close()).resolves.toBeUndefined();
  });
});
