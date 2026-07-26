-- Cooldown timestamp for organizer confirmation email resend.
alter table public.trips
  add column if not exists organizer_email_sent_at timestamptz;

comment on column public.trips.organizer_email_sent_at is
  'Last time confirmation links were emailed (resend cooldown).';
