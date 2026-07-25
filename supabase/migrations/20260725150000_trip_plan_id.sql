-- Plan tiers: free | standard | plus
alter table public.trips
  add column if not exists plan_id text not null default 'standard';

alter table public.trips
  drop constraint if exists trips_plan_id_check;

alter table public.trips
  add constraint trips_plan_id_check
  check (plan_id in ('free', 'standard', 'plus'));

comment on column public.trips.plan_id is 'Pricing tier: free (demo), standard, plus';
