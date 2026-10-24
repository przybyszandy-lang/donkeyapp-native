-- Undo supabase/review-migration.sql
drop function if exists public.admin_set_uploader(uuid, boolean, boolean);
drop function if exists public.admin_uploaders(text);
drop function if exists public.admin_review_upload(uuid, boolean);
drop function if exists public.admin_pending_uploads(integer);
drop function if exists public.admin_check();
