-- Donkey App: user uploads of memes and videos — 24 Oct 2026
-- Needs guard-migration.sql first. Undo: supabase/uploads-rollback.sql
--
-- Plan agreed 24 Oct: everyone signed in can upload memes/videos; ALL go to manual approval,
-- except "trusted uploaders" (set only by Andy) whose posts go live straight away.
-- No small daily limit; only a safety cap (20 uploads per 24 h) against storage abuse.

-- 1. Close the old "meme loophole": hidden memes were shown anyway by feed/recent/
--    favourite/profile functions and the public read rule. Without this, pending user
--    memes would appear in the live app at once. (Only 1 old rejected meme was affected.)
do $$
declare
  f record;
  def text;
begin
  for f in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosrc like '%(j.is_visible = true or coalesce(j.content_type, ''joke'') = ''meme'')%'
  loop
    def := pg_get_functiondef(f.oid);
    def := replace(def,
      '(j.is_visible = true or coalesce(j.content_type, ''joke'') = ''meme'')',
      '(j.is_visible = true /* meme-loophole-closed */)');
    execute def;
  end loop;
end $$;

drop policy if exists "Public can read visible jokes or memes" on public.jokes;
create policy "Public can read visible jokes" on public.jokes
  for select to anon, authenticated
  using (is_visible = true);

-- 2. Uploader status on profiles (set only by Andy; users cannot change these —
--    profiles updates are limited to named columns, these are not among them)
alter table public.profiles
  add column if not exists upload_trusted  boolean not null default false,
  add column if not exists uploads_blocked boolean not null default false;

-- 3. Storage: signed-in users may only ADD files inside their own folder u/<user id>/
--    (no replace, no delete, no listing). Buckets keep their size/type limits.
drop policy if exists "Users upload own memes" on storage.objects;
create policy "Users upload own memes" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'memes'
    and name like 'u/' || auth.uid()::text || '/%'
    and not coalesce((select p.uploads_blocked from public.profiles p where p.id = auth.uid()), true)
  );

drop policy if exists "Users upload own videos" on storage.objects;
create policy "Users upload own videos" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'videos'
    and name like 'u/' || auth.uid()::text || '/%'
    and not coalesce((select p.uploads_blocked from public.profiles p where p.id = auth.uid()), true)
  );

-- 4. submit_upload: the only way for users to create a meme/video post.
--    Meme: p_file = image in 'memes'. Video: p_file = mp4 in 'videos', p_poster = jpg in 'videos'.
--    Returns the new id and 'pending' or 'published'.
create or replace function public.submit_upload(
  p_type        text,
  p_file        text,
  p_poster      text,
  p_description text,
  p_language    text
)
returns table (id uuid, status text)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  prof     public.profiles;
  folder   text;
  descr    text := coalesce(btrim(p_description), '');
  new_id   uuid;
  trusted  boolean;
begin
  if uid is null then
    raise exception 'Please sign in to upload.';
  end if;

  select * into prof from public.profiles where profiles.id = uid;
  if not found or coalesce(prof.is_deleted, false) then
    raise exception 'Account not found.';
  end if;
  if prof.uploads_blocked then
    raise exception 'Uploads are not available for this account.';
  end if;

  if p_type not in ('meme', 'video') then
    raise exception 'Unknown content type.';
  end if;
  if char_length(descr) > 100 then
    raise exception 'Description is too long (max 100 characters).';
  end if;
  if p_language is null or btrim(p_language) = '' or char_length(p_language) > 40 then
    raise exception 'Please choose a language.';
  end if;

  folder := 'u/' || uid::text || '/';
  if p_file is null or left(p_file, char_length(folder)) <> folder then
    raise exception 'File not found.';
  end if;

  if p_type = 'meme' then
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'memes' and o.name = p_file
                     and (o.owner = uid or o.owner_id = uid::text)) then
      raise exception 'File not found.';
    end if;
    if exists (select 1 from public.jokes j where j.image_path = p_file) then
      raise exception 'This file has already been submitted.';
    end if;
  else
    if p_poster is null or left(p_poster, char_length(folder)) <> folder then
      raise exception 'Preview picture not found.';
    end if;
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'videos' and o.name = p_file
                     and (o.owner = uid or o.owner_id = uid::text)
                     and coalesce(o.metadata->>'mimetype', '') = 'video/mp4') then
      raise exception 'Video file not found.';
    end if;
    if not exists (select 1 from storage.objects o
                   where o.bucket_id = 'videos' and o.name = p_poster
                     and (o.owner = uid or o.owner_id = uid::text)) then
      raise exception 'Preview picture not found.';
    end if;
    if exists (select 1 from public.jokes j where j.video_path = p_file or j.image_path = p_poster) then
      raise exception 'This file has already been submitted.';
    end if;
  end if;

  -- safety cap against storage abuse
  if (select count(*) from public.jokes j
      where j.user_id = uid and j.content_type in ('meme', 'video')
        and j.created_at > now() - interval '24 hours') >= 20 then
    raise exception 'Upload limit reached for today. Please try again tomorrow.';
  end if;

  trusted := prof.upload_trusted;

  insert into public.jokes (
    content, language, user_id, content_type, image_path, video_path,
    is_visible, is_new, is_flagged, created_at, updated_at
  ) values (
    descr, btrim(p_language), uid, p_type,
    case when p_type = 'meme' then p_file else p_poster end,
    case when p_type = 'video' then p_file else null end,
    trusted, not trusted, false, now(), now()
  )
  returning jokes.id into new_id;

  return query select new_id, case when trusted then 'published' else 'pending' end;
end;
$$;

revoke all on function public.submit_upload(text, text, text, text, text) from public, anon;
grant execute on function public.submit_upload(text, text, text, text, text) to authenticated;

-- 5. Fix "archive" in My Profile (well-rated jokes): the table rules refuse it because an
--    archived row is no longer readable by its owner. The app (3.0.0+) calls this instead.
create or replace function public.archive_my_joke(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Please sign in.';
  end if;
  update public.jokes
     set user_id = null,
         added_by_email = 'deleted@donkeyapp.com',
         is_visible = false,
         is_new = false,
         updated_at = now()
   where id = p_id and user_id = auth.uid();
  if not found then
    raise exception 'Post not found.';
  end if;
end;
$$;

revoke all on function public.archive_my_joke(uuid) from public, anon;
grant execute on function public.archive_my_joke(uuid) to authenticated;
