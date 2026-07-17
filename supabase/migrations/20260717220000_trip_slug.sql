-- Short public URL: /t/{slug} instead of UUID
alter table public.trips
  add column if not exists slug text;

update public.trips
set slug = 'trip-' || substr(replace(id::text, '-', ''), 1, 8)
where slug is null or slug = '';

alter table public.trips
  alter column slug set not null;

create unique index if not exists trips_slug_key on public.trips (slug);

comment on column public.trips.slug is 'Short public URL segment: /t/{slug}';
