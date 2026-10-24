-- Undo supabase/blocks-migration.sql
drop function if exists public.record_block(text, uuid, boolean);
drop table if exists public.user_blocks;
-- The admin list functions got an extra "blocked_by_count" column. To restore the previous
-- versions, drop them and run supabase/review-migration.sql again:
drop function if exists public.admin_pending_uploads(integer);
drop function if exists public.admin_uploaders(text);
-- then run review-migration.sql
