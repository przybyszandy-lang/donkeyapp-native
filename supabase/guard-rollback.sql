-- Undo supabase/guard-migration.sql
drop trigger if exists jokes_guard on public.jokes;
drop function if exists public.jokes_guard();
