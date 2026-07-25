-- SAVE-2: フレーム・コメント・日付なしの元写真を並行保存する
-- raw_path はフィルターのみ適用した 3:4 JPEG（フレーム焼き込みなし）
alter table public.photos add column if not exists raw_path text;
