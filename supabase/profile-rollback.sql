-- Undo supabase/profile-migration.sql
-- Note: profile pictures already uploaded stay in the avatars bucket until deleted in the dashboard
-- (the bucket itself can only be removed once empty).

drop function if exists public.get_public_profile(uuid);

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
    updated_at = now()
  where id = v_user_id;
end;
$function$;

drop policy if exists "Users upload own avatar" on storage.objects;
drop policy if exists "Users replace own avatar" on storage.objects;
drop policy if exists "Users read own avatar" on storage.objects;
drop policy if exists "Users delete own avatar" on storage.objects;

revoke update (bio, website, avatar_updated_at) on public.profiles from authenticated;

-- Restore the previous (wider) insert right. Not recommended: lets users create admin profiles.
-- grant insert on public.profiles to authenticated;

alter table public.profiles drop constraint if exists profiles_bio_length;
alter table public.profiles drop constraint if exists profiles_website_format;
alter table public.profiles
  drop column if exists bio,
  drop column if exists website,
  drop column if exists avatar_updated_at;
