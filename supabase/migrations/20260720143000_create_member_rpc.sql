-- create_member RPC: anon INSERT on members cannot use RETURNING without SELECT.
-- Keep SELECT revoked; return id via security definer.

create or replace function public.create_member(p_trip_id uuid, p_nickname text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  trimmed text := trim(p_nickname);
  new_id uuid;
begin
  if trimmed is null or trimmed = '' or char_length(trimmed) > 12 then
    raise exception 'invalid nickname';
  end if;

  insert into public.members (trip_id, nickname)
  values (p_trip_id, trimmed)
  returning id into new_id;

  return new_id;
end;
$$;

revoke all on function public.create_member(uuid, text) from public;
grant execute on function public.create_member(uuid, text) to anon;
