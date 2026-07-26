-- Organizer contact email for confirmation / resend from manage settings.
alter table public.trips
  add column if not exists organizer_email text;

comment on column public.trips.organizer_email is
  'Organizer contact email for link confirmation mail';
