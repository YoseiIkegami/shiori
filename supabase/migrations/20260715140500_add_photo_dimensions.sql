-- Store final (post-resize) pixel dimensions so PhotoSwipe can lay out each
-- slide at the correct aspect ratio instead of stretching to a default.

alter table public.photos
  add column if not exists width int,
  add column if not exists height int;
