-- Phase 2a: service-ization core
--   - trips settings columns (nicknames / comment_required / date_format / theme)
--   - payment_status + short organizer_token + expires_at
--   - reveal_at made nullable (optional "end time"); composite reveal (count OR time)
--   - members / orders tables
--   - paid guard on photo insert
--   - backfill existing trips (summer-boardgames / test) to paid, expires_at NULL
--
-- slug: already exists (20260717220000_trip_slug.sql) and is UNIQUE. We do NOT
-- re-add it or overwrite existing values, so /t/summer-boardgames and /t/test keep working.
-- slug format/reserved-word validation lives in the app + Edge Function (create-trip-checkout),
-- not as a hard DB CHECK, to avoid failing on legacy backfilled slugs.

-- ---------------------------------------------------------------------------
-- Short organizer token (base62). Used in /manage/{slug}?token=...
-- ---------------------------------------------------------------------------

create or replace function public.generate_short_token(length int default 10)
returns text
language plpgsql
volatile
as $$
declare
  chars text := 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  result text := '';
  i int;
begin
  for i in 1..length loop
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- Not a public Data API RPC.
revoke all on function public.generate_short_token(int) from public;
revoke all on function public.generate_short_token(int) from anon;
revoke all on function public.generate_short_token(int) from authenticated;

-- ---------------------------------------------------------------------------
-- trips: new columns
-- ---------------------------------------------------------------------------

alter table public.trips
  add column if not exists show_nicknames  boolean not null default false,
  add column if not exists comment_required boolean not null default true,
  add column if not exists date_format      text    not null default 'YY.M.D',
  add column if not exists expires_at       timestamptz,
  add column if not exists payment_status   text    not null default 'pending',
  add column if not exists theme_id         text    not null default 'classic',
  add column if not exists organizer_token  text    not null default public.generate_short_token();

-- date_format allowed values (matches SPEC §5).
alter table public.trips drop constraint if exists trips_date_format_check;
alter table public.trips
  add constraint trips_date_format_check
  check (date_format in ('YY.M.D', 'YYYY.M.D', 'YY.M.D HH:mm', 'none'));

-- payment_status allowed values.
alter table public.trips drop constraint if exists trips_payment_status_check;
alter table public.trips
  add constraint trips_payment_status_check
  check (payment_status in ('pending', 'paid'));

-- organizer_token unique.
create unique index if not exists trips_organizer_token_key on public.trips (organizer_token);

-- reveal_at becomes optional "end time" (was NOT NULL in Phase 1).
alter table public.trips alter column reveal_at drop not null;

-- ---------------------------------------------------------------------------
-- Backfill existing trips (summer-boardgames / test): keep them usable.
--   paid, no expiry (protected from the future delete batch), fresh short token.
-- ---------------------------------------------------------------------------

update public.trips
set payment_status = 'paid',
    expires_at = null
where payment_status is distinct from 'paid';

-- Phase 1 required reveal_at as a placeholder (unused for unlock). Clear it so
-- time-based lazy promote does not accidentally unlock incomplete trips.
update public.trips
set reveal_at = null
where reveal_at is not null;

-- Any legacy rows created before this column existed get a real short token.
update public.trips
set organizer_token = public.generate_short_token()
where organizer_token is null or organizer_token = '';

-- ---------------------------------------------------------------------------
-- members (nickname). UI arrives in Phase 2b; the table + RLS shell is here now.
-- ---------------------------------------------------------------------------

create table if not exists public.members (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) not null,
  nickname text not null,
  created_at timestamptz default now(),
  constraint members_nickname_max_length check (char_length(nickname) <= 12)
);

create index if not exists members_trip_id_idx on public.members (trip_id);

alter table public.photos
  add column if not exists member_id uuid references public.members(id);

alter table public.members enable row level security;

-- anon may create a nickname and update *their own* row (id kept in localStorage).
-- MVP: no strict identity check — anyone who knows the id can update it.
drop policy if exists "anon_insert_members" on public.members;
create policy "anon_insert_members"
  on public.members
  for insert
  to anon
  with check (true);

drop policy if exists "anon_update_members" on public.members;
create policy "anon_update_members"
  on public.members
  for update
  to anon
  using (true)
  with check (true);

-- Nickname read happens through the reveal Edge Function (service_role); no anon SELECT.
grant insert, update on table public.members to anon;
revoke select, delete on table public.members from anon;

-- ---------------------------------------------------------------------------
-- orders (payment records). Written only by the Stripe webhook (service_role).
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) not null,
  stripe_session_id text not null,
  amount int not null,
  currency text not null,
  type text not null,
  created_at timestamptz default now(),
  constraint orders_type_check check (type in ('base', 'extend'))
);

create index if not exists orders_trip_id_idx on public.orders (trip_id);
create unique index if not exists orders_stripe_session_id_key on public.orders (stripe_session_id);

alter table public.orders enable row level security;
-- No anon policies at all: orders are service_role-only.
revoke select, insert, update, delete on table public.orders from anon;

-- ---------------------------------------------------------------------------
-- Paid guard: reject photo inserts for trips that have not paid.
-- ---------------------------------------------------------------------------

create or replace function public.enforce_trip_paid_before_photo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status text;
begin
  select payment_status into status from public.trips where id = new.trip_id;
  if status is distinct from 'paid' then
    raise exception 'trip % is not paid', new.trip_id
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_trip_paid_before_photo() from public;
revoke all on function public.enforce_trip_paid_before_photo() from anon;
revoke all on function public.enforce_trip_paid_before_photo() from authenticated;

drop trigger if exists photos_before_insert_paid on public.photos;
create trigger photos_before_insert_paid
  before insert on public.photos
  for each row
  execute function public.enforce_trip_paid_before_photo();

-- ---------------------------------------------------------------------------
-- Composite reveal: promote to revealed when the optional end time has passed.
--   Callable by anon (client fetchTrip) — security definer, tightly scoped:
--   only flips is_revealed to true when reveal_at is set and already elapsed.
-- ---------------------------------------------------------------------------

create or replace function public.maybe_reveal_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  revealed boolean;
begin
  update public.trips
  set is_revealed = true
  where id = p_trip_id
    and is_revealed is distinct from true
    and reveal_at is not null
    and now() >= reveal_at;

  select is_revealed into revealed from public.trips where id = p_trip_id;
  return coalesce(revealed, false);
end;
$$;

revoke all on function public.maybe_reveal_trip(uuid) from public;
grant execute on function public.maybe_reveal_trip(uuid) to anon;
