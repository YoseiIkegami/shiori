-- share_token: unguessable public URL key (capability URL).
-- slug remains human title / UNIQUE; legacy /t/{slug} still resolves via app fallback.

alter table public.trips
  add column if not exists share_token text;

-- Backfill existing rows before NOT NULL + UNIQUE.
update public.trips
set share_token = public.generate_short_token(22)
where share_token is null or share_token = '';

-- Keep verification URL /t/test working via share_token (and slug fallback).
update public.trips
set share_token = 'test'
where slug = 'test';

alter table public.trips
  alter column share_token set default public.generate_short_token(22),
  alter column share_token set not null;

create unique index if not exists trips_share_token_key
  on public.trips (share_token);
