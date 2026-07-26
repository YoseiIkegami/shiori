-- Retention for Standard starts at reveal (public unlock), not at payment.
-- reveal_trip: set is_revealed and, for plan_id=standard with null expires_at, now()+30 days.

create or replace function public.reveal_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  revealed boolean;
begin
  update public.trips
  set
    is_revealed = true,
    expires_at = case
      when plan_id = 'standard' and expires_at is null
        then now() + interval '30 days'
      else expires_at
    end
  where id = p_trip_id
    and is_revealed is distinct from true;

  select is_revealed into revealed from public.trips where id = p_trip_id;
  return coalesce(revealed, false);
end;
$$;

revoke all on function public.reveal_trip(uuid) from public;
grant execute on function public.reveal_trip(uuid) to anon, authenticated, service_role;

create or replace function public.on_photo_inserted_update_trip_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_count int;
  trip_max int;
begin
  update public.trips
  set photos_count = photos_count + 1
  where id = new.trip_id
  returning photos_count, max_photos into new_count, trip_max;

  if new_count >= trip_max then
    perform public.reveal_trip(new.trip_id);
  end if;

  return new;
end;
$$;

create or replace function public.maybe_reveal_trip(p_trip_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  revealed boolean;
  due boolean;
begin
  select
    reveal_at is not null and now() >= reveal_at,
    is_revealed
  into due, revealed
  from public.trips
  where id = p_trip_id;

  if due and revealed is distinct from true then
    return public.reveal_trip(p_trip_id);
  end if;

  return coalesce(revealed, false);
end;
$$;
