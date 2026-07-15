-- Composed polaroid JPEGs are always 1200×1440; per-row width/height are unused.
alter table public.photos
  drop column if exists width,
  drop column if exists height;
