-- Share invite copy language (independent of UI locale).
alter table public.trips
  add column if not exists share_locale text not null default 'ja';

alter table public.trips
  drop constraint if exists trips_share_locale_check;

alter table public.trips
  add constraint trips_share_locale_check
  check (share_locale in ('ja', 'en'));

comment on column public.trips.share_locale is
  'Language for share title/body (ja|en). Independent of UI locale.';
