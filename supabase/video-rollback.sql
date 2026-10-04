-- Donkey App video project: UNDO (rollback) of supabase/video-migration.sql
-- Only use this if the video project is abandoned. Run in the Supabase SQL Editor, in this order.

-- 1. Hide any video rows so the original functions can never show them
update public.jokes set is_visible = false where content_type = 'video';

-- 2. Restore the 3 original functions:
--    run the whole of supabase/pre-video/functions-backup.sql

-- 3. Remove the new functions
drop function if exists public.get_jokes_feed_mixed_v2(integer, timestamp with time zone, uuid, text, text);
drop function if exists public.get_recent_jokes_with_names_mixed_v2(text, integer);
drop function if exists public.get_favourite_jokes_with_names_mixed_v2(uuid[]);
drop function if exists public.get_profile_jokes_with_name_mixed_v2(uuid);
drop function if exists public.get_reel_videos(text, integer, timestamp with time zone, uuid);

-- 4. Remove the upload rule
drop policy if exists "Admins can upload videos" on storage.objects;

-- 5. Remove the videos bucket:
--    first empty it in Supabase dashboard > Storage > videos, then:
delete from storage.buckets where id = 'videos';

-- 6. Remove the video_path column (only after step 1)
alter table public.jokes drop column if exists video_path;