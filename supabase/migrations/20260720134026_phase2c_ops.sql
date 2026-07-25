-- Phase 2c: ops — reported-photo hide flag, nickname update RPC, purge helper
--
-- - photos.is_hidden: set by report-photo Edge Function (service_role)
-- - update_member_nickname: anon can UPDATE by id without SELECT-all on members
-- - purge_expired_trips(): deletes DB rows for expired trips (Storage cleaned by Edge Function)
--   ALWAYS skips expires_at IS NULL (protects summer-boardgames / test)

-- ---------------------------------------------------------------------------
-- photos.is_hidden
-- ---------------------------------------------------------------------------

alter table public.photos
  add column if not exists is_hidden boolean not null default false;

create index if not exists photos_is_hidden_idx
  on public.photos (trip_id)
  where is_hidden = true;

-- ---------------------------------------------------------------------------
-- Nickname update without granting anon SELECT on members
-- (Postgres RLS UPDATE needs a visible row; open SELECT would leak nicknames.)
-- ---------------------------------------------------------------------------

create or replace function public.update_member_nickname(p_id uuid, p_nickname text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text := trim(p_nickname);
begin
  if trimmed is null or trimmed = '' or char_length(trimmed) > 12 then
    raise exception 'invalid nickname';
  end if;
  update public.members
  set nickname = trimmed
  where id = p_id;
  if not found then
    raise exception 'member not found';
  end if;
end;
$$;

revoke all on function public.update_member_nickname(uuid, text) from public;
grant execute on function public.update_member_nickname(uuid, text) to anon;

-- ---------------------------------------------------------------------------
-- Purge expired trips (DB side). Edge Function deletes Storage objects first,
-- then calls this. NEVER touches expires_at IS NULL.
-- ---------------------------------------------------------------------------

create or replace function public.purge_expired_trips(p_dry_run boolean default false)
returns table (trip_id uuid, slug text, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select t.id, t.slug, t.expires_at
    from public.trips t
    where t.expires_at is not null
      and t.expires_at < now()
  loop
    trip_id := r.id;
    slug := r.slug;
    expires_at := r.expires_at;
    return next;

    if p_dry_run = false then
      delete from public.photos where public.photos.trip_id = r.id;
      delete from public.members where public.members.trip_id = r.id;
      delete from public.orders where public.orders.trip_id = r.id;
      delete from public.trips where public.trips.id = r.id;
    end if;
  end loop;
end;
$$;

revoke all on function public.purge_expired_trips(boolean) from public;
revoke all on function public.purge_expired_trips(boolean) from anon;
revoke all on function public.purge_expired_trips(boolean) from authenticated;
