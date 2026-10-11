-- Donkey App — creator profile (11 Oct 2026)
-- Adds: about me, website, profile picture, public profile function.
-- Also closes a gap: signed-in users could create their own profile row already marked admin.
-- Undo: supabase/profile-rollback.sql
-- Safe for the live app 2.1.11: it only reads display_name / is_admin, which are unchanged.

-- 1. New profile fields --------------------------------------------------------
alter table public.profiles
  add column if not exists bio text,
  add column if not exists website text,
  add column if not exists avatar_updated_at timestamptz;

alter table public.profiles
  drop constraint if exists profiles_bio_length,
  add constraint profiles_bio_length check (bio is null or char_length(bio) <= 1000);

alter table public.profiles
  drop constraint if exists profiles_website_format,
  add constraint profiles_website_format check (
    website is null
    or (char_length(website) <= 200 and website ~* '^https?://[^\s/$.?#][^\s]*$')
  );

-- 2. Who may write which columns ----------------------------------------------
-- Insert: only the columns the app sets (no more self-made admins).
revoke insert on public.profiles from authenticated;
grant insert (id, email, display_name, created_at, updated_at) on public.profiles to authenticated;

-- Update: existing (display_name, email, updated_at) + new profile fields.
grant update (bio, website, avatar_updated_at) on public.profiles to authenticated;

-- 3. Profile pictures ------------------------------------------------------------
-- One file per user, always the same name: avatars/<user id>/avatar.jpg
-- Uploading a new picture overwrites the old one. App adds ?v=<avatar_updated_at> to show the new one.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 2097152, array['image/jpeg'])
on conflict (id) do update
  set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg'];

drop policy if exists "Users upload own avatar" on storage.objects;
drop policy if exists "Users replace own avatar" on storage.objects;
drop policy if exists "Users read own avatar" on storage.objects;
drop policy if exists "Users delete own avatar" on storage.objects;

create policy "Users upload own avatar" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.jpg');

create policy "Users replace own avatar" on storage.objects
  for update to authenticated
  using (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.jpg')
  with check (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.jpg');

create policy "Users read own avatar" on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.jpg');

create policy "Users delete own avatar" on storage.objects
  for delete to authenticated
  using (bucket_id = 'avatars' and name = (auth.uid())::text || '/avatar.jpg');

-- 4. Public profile (header of the profile page) ---------------------------------
create or replace function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid,
  display_name text,
  bio text,
  website text,
  avatar_updated_at timestamptz,
  joined_at timestamptz,
  joke_count bigint,
  meme_count bigint,
  video_count bigint,
  votes_received bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.display_name,
    p.bio,
    p.website,
    p.avatar_updated_at,
    p.created_at as joined_at,
    count(j.id) filter (where coalesce(j.content_type, 'joke') = 'joke'),
    count(j.id) filter (where j.content_type = 'meme'),
    count(j.id) filter (where j.content_type = 'video'),
    coalesce(sum(
      coalesce(j.rating_bad_count, 0) + coalesce(j.rating_meh_count, 0)
      + coalesce(j.rating_good_count, 0) + coalesce(j.rating_great_count, 0)
    ), 0)::bigint
  from public.profiles p
  left join public.jokes j
    on j.user_id = p.id
   and (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
   and coalesce(j.content_type, 'joke') in ('joke', 'meme', 'video')
  where p.id = p_user_id
    and coalesce(p.is_deleted, false) = false
  group by p.id;
$$;

revoke all on function public.get_public_profile(uuid) from public;
grant execute on function public.get_public_profile(uuid) to anon, authenticated;

-- 5. Deleting an account also clears the public profile fields --------------------
create or replace function public.soft_delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;

  update public.profiles
  set
    is_deleted = true,
    deleted_at = now(),
    updated_at = now(),
    bio = null,
    website = null,
    avatar_updated_at = null
  where id = v_user_id;
end;
$function$;
