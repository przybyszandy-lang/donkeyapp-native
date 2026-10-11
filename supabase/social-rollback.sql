-- Undo supabase/social-migration.sql (keeps profile-migration.sql in place)

drop function if exists public.follow_user(uuid);
drop function if exists public.unfollow_user(uuid);
drop function if exists public.get_followers(uuid, int, int);
drop function if exists public.get_following(uuid, int, int);
drop function if exists public.get_user_events(uuid);
drop function if exists public.get_profile_cards(uuid[]);
drop trigger if exists creator_events_limit on public.creator_events;
drop function if exists public.creator_events_limit();
drop table if exists public.creator_events;
drop table if exists public.follows;

-- get_public_profile back to the profile-migration.sql version
drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid, display_name text, bio text, website text, avatar_updated_at timestamptz,
  joined_at timestamptz, joke_count bigint, meme_count bigint, video_count bigint, votes_received bigint
)
language sql stable security definer set search_path = public
as $$
  select
    p.id, p.display_name, p.bio, p.website, p.avatar_updated_at, p.created_at as joined_at,
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

create or replace function public.soft_delete_my_account()
returns void
language plpgsql security definer set search_path = public
as $function$
declare
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'Not authenticated';
  end if;
  update public.profiles
  set is_deleted = true, deleted_at = now(), updated_at = now(),
      bio = null, website = null, avatar_updated_at = null
  where id = v_user_id;
end;
$function$;

revoke update (instagram, tiktok, youtube, x_handle, facebook, show_followers, show_following)
  on public.profiles from authenticated;
alter table public.profiles drop constraint if exists profiles_social_format;
alter table public.profiles
  drop column if exists instagram,
  drop column if exists tiktok,
  drop column if exists youtube,
  drop column if exists x_handle,
  drop column if exists facebook,
  drop column if exists show_followers,
  drop column if exists show_following;
