-- Trigger-only function: do not expose it as a callable Data API RPC.
revoke all on function public.on_photo_inserted_update_trip_count() from public;
revoke all on function public.on_photo_inserted_update_trip_count() from anon;
revoke all on function public.on_photo_inserted_update_trip_count() from authenticated;
