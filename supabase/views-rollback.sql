-- Undo supabase/views-migration.sql (removes view counting and ALL view data).
drop function if exists public.get_points_total(date, date);
drop function if exists public.get_my_views_daily(uuid, date, date);
drop function if exists public.get_content_item(uuid);
drop function if exists public.get_views_daily(uuid, date, date);
drop function if exists public.get_my_content_stats(date, date);
drop function if exists public.get_content_stats(date, date);
drop function if exists public.record_views(text, jsonb, text, text);
drop function if exists public.view_points(text, smallint);
drop table if exists public.content_views;
