-- Count-based reveal: increment photos_count on insert; unlock at max_photos.

alter table public.trips
  add column if not exists photos_count int not null default 0,
  add column if not exists max_photos int not null default 50;

-- Backfill counts from existing photos.
update public.trips t
set photos_count = coalesce((
  select count(*)::int from public.photos p where p.trip_id = t.id
), 0);

-- Unlock trips already at or over the limit.
update public.trips
set is_revealed = true
where photos_count >= max_photos;

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
    update public.trips
    set is_revealed = true
    where id = new.trip_id and is_revealed is distinct from true;
  end if;

  return new;
end;
$$;

drop trigger if exists photos_after_insert_count on public.photos;
create trigger photos_after_insert_count
  after insert on public.photos
  for each row
  execute function public.on_photo_inserted_update_trip_count();
