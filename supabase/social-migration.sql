-- Donkey App — social links, followers, events (11 Oct 2026)
-- Needs supabase/profile-migration.sql first. Undo: supabase/social-rollback.sql
-- Safe for the live app 2.1.11 (new columns / tables / functions only).

-- 1. Social links + follower privacy ------------------------------------------------
-- Social links are stored as usernames (no @), the app builds the link.
alter table public.profiles
  add column if not exists instagram text,
  add column if not exists tiktok text,
  add column if not exists youtube text,
  add column if not exists x_handle text,
  add column if not exists facebook text,
  add column if not exists show_followers boolean not null default true,
  add column if not exists show_following boolean not null default true;

alter table public.profiles drop constraint if exists profiles_social_format;
alter table public.profiles add constraint profiles_social_format check (
      (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$')
  and (tiktok    is null or tiktok    ~ '^[A-Za-z0-9._]{1,30}$')
  and (youtube   is null or youtube   ~ '^[A-Za-z0-9._-]{1,60}$')
  and (x_handle  is null or x_handle  ~ '^[A-Za-z0-9_]{1,15}$')
  and (facebook  is null or facebook  ~ '^[A-Za-z0-9.]{1,60}$')
);

grant update (instagram, tiktok, youtube, x_handle, facebook, show_followers, show_following)
  on public.profiles to authenticated;

-- 2. Followers ------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  constraint follows_not_self check (follower_id <> followee_id)
);
create index if not exists follows_followee_idx on public.follows (followee_id, created_at desc);

alter table public.follows enable row level security;
revoke all on public.follows from anon, authenticated;
grant select on public.follows to authenticated;

drop policy if exists "Users see whom they follow" on public.follows;
create policy "Users see whom they follow" on public.follows
  for select to authenticated using (follower_id = auth.uid());

-- Follow / unfollow (the only way to change follows)
create or replace function public.follow_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null then raise exception 'Not authenticated'; end if;
  if p_user_id = v_me then raise exception 'You cannot follow yourself'; end if;
  if not exists (select 1 from profiles where id = v_me and coalesce(is_deleted, false) = false) then
    raise exception 'Profile not found';
  end if;
  if not exists (select 1 from profiles where id = p_user_id and coalesce(is_deleted, false) = false) then
    raise exception 'User not found';
  end if;
  if (select count(*) from follows where follower_id = v_me) >= 5000 then
    raise exception 'Follow limit reached';
  end if;
  insert into follows (follower_id, followee_id) values (v_me, p_user_id)
  on conflict do nothing;
end;
$$;

create or replace function public.unfollow_user(p_user_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Not authenticated'; end if;
  delete from follows where follower_id = auth.uid() and followee_id = p_user_id;
end;
$$;

-- Lists (respect the privacy switches; the owner always sees their own lists)
create or replace function public.get_followers(p_user_id uuid, p_limit int default 50, p_offset int default 0)
returns table (id uuid, display_name text, avatar_updated_at timestamptz, followed_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name, p.avatar_updated_at, f.created_at
  from follows f
  join profiles p on p.id = f.follower_id and coalesce(p.is_deleted, false) = false
  join profiles owner on owner.id = p_user_id and coalesce(owner.is_deleted, false) = false
  where f.followee_id = p_user_id
    and (owner.show_followers or auth.uid() = p_user_id)
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

create or replace function public.get_following(p_user_id uuid, p_limit int default 50, p_offset int default 0)
returns table (id uuid, display_name text, avatar_updated_at timestamptz, followed_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.display_name, p.avatar_updated_at, f.created_at
  from follows f
  join profiles p on p.id = f.followee_id and coalesce(p.is_deleted, false) = false
  join profiles owner on owner.id = p_user_id and coalesce(owner.is_deleted, false) = false
  where f.follower_id = p_user_id
    and (owner.show_following or auth.uid() = p_user_id)
  order by f.created_at desc
  limit least(greatest(p_limit, 1), 100) offset greatest(p_offset, 0);
$$;

-- 3. Events (e.g. upcoming shows) --------------------------------------------------------
create table if not exists public.creator_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  venue text check (venue is null or char_length(venue) <= 80),
  city text check (city is null or char_length(city) <= 60),
  starts_at timestamptz not null,
  ticket_url text check (
    ticket_url is null or (char_length(ticket_url) <= 200 and ticket_url ~* '^https?://[^\s/$.?#][^\s]*$')
  ),
  created_at timestamptz not null default now()
);
create index if not exists creator_events_user_idx on public.creator_events (user_id, starts_at);

alter table public.creator_events enable row level security;
revoke all on public.creator_events from anon, authenticated;
grant select, delete on public.creator_events to authenticated;
grant insert (title, venue, city, starts_at, ticket_url) on public.creator_events to authenticated;
grant update (title, venue, city, starts_at, ticket_url) on public.creator_events to authenticated;

drop policy if exists "Users manage own events" on public.creator_events;
create policy "Users manage own events" on public.creator_events
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Max 30 upcoming events per user
create or replace function public.creator_events_limit()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if (select count(*) from creator_events
      where user_id = new.user_id and starts_at > now() - interval '1 day') >= 30 then
    raise exception 'You can have up to 30 upcoming events';
  end if;
  return new;
end;
$$;
drop trigger if exists creator_events_limit on public.creator_events;
create trigger creator_events_limit before insert on public.creator_events
  for each row execute function public.creator_events_limit();

-- Public: upcoming events of one user (shown until 6 hours after start)
create or replace function public.get_user_events(p_user_id uuid)
returns table (id uuid, title text, venue text, city text, starts_at timestamptz, ticket_url text)
language sql stable security definer set search_path = public
as $$
  select e.id, e.title, e.venue, e.city, e.starts_at, e.ticket_url
  from creator_events e
  join profiles p on p.id = e.user_id and coalesce(p.is_deleted, false) = false
  where e.user_id = p_user_id
    and e.starts_at > now() - interval '6 hours'
  order by e.starts_at
  limit 20;
$$;

-- 4. Profile pictures for feed cards (one call for many users) -----------------------------
create or replace function public.get_profile_cards(p_ids uuid[])
returns table (id uuid, avatar_updated_at timestamptz)
language sql stable security definer set search_path = public
as $$
  select p.id, p.avatar_updated_at
  from profiles p
  where p.id = any (p_ids[1:200])
    and coalesce(p.is_deleted, false) = false;
$$;

-- 5. Public profile, now with social links, follower counts and "do I follow" -----------------
drop function if exists public.get_public_profile(uuid);
create function public.get_public_profile(p_user_id uuid)
returns table (
  id uuid, display_name text, bio text, website text, avatar_updated_at timestamptz,
  joined_at timestamptz, joke_count bigint, meme_count bigint, video_count bigint, votes_received bigint,
  instagram text, tiktok text, youtube text, x_handle text, facebook text,
  followers_count bigint, following_count bigint, show_followers boolean, show_following boolean,
  i_follow boolean
)
language sql stable security definer set search_path = public
as $$
  with content as (
    select
      count(*) filter (where coalesce(j.content_type, 'joke') = 'joke') as jokes,
      count(*) filter (where j.content_type = 'meme') as memes,
      count(*) filter (where j.content_type = 'video') as videos,
      coalesce(sum(
        coalesce(j.rating_bad_count, 0) + coalesce(j.rating_meh_count, 0)
        + coalesce(j.rating_good_count, 0) + coalesce(j.rating_great_count, 0)
      ), 0)::bigint as votes
    from jokes j
    where j.user_id = p_user_id
      and (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
      and coalesce(j.content_type, 'joke') in ('joke', 'meme', 'video')
  )
  select
    p.id, p.display_name, p.bio, p.website, p.avatar_updated_at, p.created_at,
    c.jokes, c.memes, c.videos, c.votes,
    p.instagram, p.tiktok, p.youtube, p.x_handle, p.facebook,
    (select count(*) from follows f join profiles x on x.id = f.follower_id and coalesce(x.is_deleted, false) = false
      where f.followee_id = p.id),
    (select count(*) from follows f join profiles x on x.id = f.followee_id and coalesce(x.is_deleted, false) = false
      where f.follower_id = p.id),
    p.show_followers, p.show_following,
    exists (select 1 from follows f where f.follower_id = auth.uid() and f.followee_id = p.id)
  from profiles p
  cross join content c
  where p.id = p_user_id
    and coalesce(p.is_deleted, false) = false;
$$;

-- 6. Who may call what -------------------------------------------------------------------
revoke all on function public.get_public_profile(uuid) from public;
revoke all on function public.get_followers(uuid, int, int) from public;
revoke all on function public.get_following(uuid, int, int) from public;
revoke all on function public.get_user_events(uuid) from public;
revoke all on function public.get_profile_cards(uuid[]) from public;
revoke all on function public.follow_user(uuid) from public;
revoke all on function public.unfollow_user(uuid) from public;
revoke all on function public.creator_events_limit() from public;

grant execute on function public.get_public_profile(uuid) to anon, authenticated;
grant execute on function public.get_followers(uuid, int, int) to anon, authenticated;
grant execute on function public.get_following(uuid, int, int) to anon, authenticated;
grant execute on function public.get_user_events(uuid) to anon, authenticated;
grant execute on function public.get_profile_cards(uuid[]) to anon, authenticated;
grant execute on function public.follow_user(uuid) to authenticated;
grant execute on function public.unfollow_user(uuid) to authenticated;

-- 7. Deleting an account also removes follows, events and social links ----------------------
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
  delete from follows where follower_id = v_user_id or followee_id = v_user_id;
  delete from creator_events where user_id = v_user_id;
  update public.profiles
  set is_deleted = true, deleted_at = now(), updated_at = now(),
      bio = null, website = null, avatar_updated_at = null,
      instagram = null, tiktok = null, youtube = null, x_handle = null, facebook = null
  where id = v_user_id;
end;
$function$;
