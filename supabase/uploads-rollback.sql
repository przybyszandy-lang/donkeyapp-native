-- Undo supabase/uploads-migration.sql
-- (Uploaded files in u/<user id>/ folders and any uploaded posts are NOT deleted.)

-- 5.
drop function if exists public.archive_my_joke(uuid);

-- 4.
drop function if exists public.submit_upload(text, text, text, text, text);

-- 3.
drop policy if exists "Users upload own memes" on storage.objects;
drop policy if exists "Users upload own videos" on storage.objects;

-- 2.
alter table public.profiles
  drop column if exists upload_trusted,
  drop column if exists uploads_blocked;

-- 1. reopen the meme loophole (WARNING: pending user memes would then show in feeds)
drop policy if exists "Public can read visible jokes" on public.jokes;
create policy "Public can read visible jokes or memes" on public.jokes
  for select to anon, authenticated
  using ((is_visible = true) or (coalesce(content_type, 'joke') = 'meme'));

do $$
declare
  f record;
  def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc like '%meme-loophole-closed%'
  loop
    def := pg_get_functiondef(f.oid);
    def := replace(def,
      '(j.is_visible = true /* meme-loophole-closed */)',
      '(j.is_visible = true or coalesce(j.content_type, ''joke'') = ''meme'')');
    execute def;
  end loop;
end $$;
