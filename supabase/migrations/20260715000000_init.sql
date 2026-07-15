-- Phase 1: trips / photos + RLS + private storage bucket
-- NOTE: After deploying to Vercel, add the production origin to Supabase Storage CORS
-- (Dashboard → Storage → Configuration → CORS). Forgetting this breaks direct uploads.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  reveal_at timestamptz not null,
  is_revealed boolean default false,
  created_at timestamptz default now()
);

create table public.photos (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid references public.trips(id) not null,
  storage_path text not null,
  comment text not null,
  rotation float,
  created_at timestamptz default now(),
  constraint photos_comment_max_length check (char_length(comment) <= 30)
);

create index photos_trip_id_idx on public.photos (trip_id);

-- ---------------------------------------------------------------------------
-- RLS: trips — anon SELECT only (no INSERT/UPDATE/DELETE via client)
-- ---------------------------------------------------------------------------

alter table public.trips enable row level security;

create policy "anon_select_trips"
  on public.trips
  for select
  to anon
  using (true);

-- Explicitly no INSERT/UPDATE/DELETE policies for anon.
-- Trip rows are created manually in the Supabase dashboard (service role / SQL editor).

grant select on table public.trips to anon;
revoke insert, update, delete on table public.trips from anon;

-- ---------------------------------------------------------------------------
-- RLS: photos — anon INSERT only (no SELECT; gallery goes through Edge Function)
-- ---------------------------------------------------------------------------

alter table public.photos enable row level security;

create policy "anon_insert_photos"
  on public.photos
  for insert
  to anon
  with check (true);

-- No SELECT / UPDATE / DELETE policies for anon — intentional.
-- Reading photos must use Edge Function with service_role + reveal check.

grant insert on table public.photos to anon;
revoke select, update, delete on table public.photos from anon;

-- ---------------------------------------------------------------------------
-- Storage: private bucket trip-photos — anon INSERT only
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trip-photos',
  'trip-photos',
  false,
  10485760,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do nothing;

-- Allow anon to upload into trip-photos (path: {trip_id}/{filename})
create policy "anon_insert_trip_photos"
  on storage.objects
  for insert
  to anon
  with check (
    bucket_id = 'trip-photos'
  );

-- Intentionally NO select / update / delete policies for anon on storage.objects
-- for this bucket. Signed URLs are issued by Edge Function with service_role.
