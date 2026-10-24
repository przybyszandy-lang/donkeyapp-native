-- Donkey App: users blocking other users — 24 Oct 2026
-- Blocking is personal: the app hides the blocked person's posts on that phone (list kept on
-- the phone). This table only lets Andy see in admin how many people blocked someone.
-- Undo: supabase/blocks-rollback.sql

create table if not exists public.user_blocks (
  device_id  text not null,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  blocker_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (device_id, blocked_id)
);
alter table public.user_blocks enable row level security;
-- no policies: only the functions below can read or write it
revoke all on public.user_blocks from anon, authenticated;

-- Called by the app when someone blocks (p_blocked = true) or unblocks (false).
-- A signed-in blocker also loses any follow between the two of them.
create or replace function public.record_block(p_device_id text, p_blocked_id uuid, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if p_device_id is null or char_length(p_device_id) < 16 or char_length(p_device_id) > 100 then
    raise exception 'Invalid device.';
  end if;
  if p_blocked_id is null or p_blocked_id = uid then
    return;
  end if;

  if coalesce(p_blocked, false) then
    if (select count(*) from public.user_blocks b where b.device_id = p_device_id) >= 500 then
      return; -- quietly ignore beyond 500 blocks per phone
    end if;
    insert into public.user_blocks (device_id, blocked_id, blocker_id)
    select p_device_id, p_blocked_id, uid
    where exists (select 1 from public.profiles p where p.id = p_blocked_id)
    on conflict (device_id, blocked_id) do update set blocker_id = excluded.blocker_id;

    if uid is not null then
      delete from public.follows
       where (follower_id = uid and followee_id = p_blocked_id)
          or (follower_id = p_blocked_id and followee_id = uid);
    end if;
  else
    delete from public.user_blocks b where b.device_id = p_device_id and b.blocked_id = p_blocked_id;
  end if;
end;
$$;

revoke all on function public.record_block(text, uuid, boolean) from public;
grant execute on function public.record_block(text, uuid, boolean) to anon, authenticated;

-- Admin: add "blocked by" counts to the review page lists (return type changes → recreate)
drop function if exists public.admin_pending_uploads(integer);
create function public.admin_pending_uploads(p_limit integer default 50)
returns table (
  id uuid, content_type text, content text, language text, created_at timestamptz,
  image_path text, video_path text, user_id uuid, display_name text, email text,
  upload_trusted boolean, uploads_blocked boolean, approved_count bigint, rejected_count bigint,
  blocked_by_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_check();
  return query
  select j.id, j.content_type, j.content, j.language, j.created_at,
         j.image_path, j.video_path, j.user_id,
         coalesce(nullif(trim(p.display_name), ''), 'No name'), p.email,
         coalesce(p.upload_trusted, false), coalesce(p.uploads_blocked, false),
         (select count(*) from public.jokes a where a.user_id = j.user_id and a.content_type in ('meme','video') and a.is_visible = true),
         (select count(*) from public.jokes a where a.user_id = j.user_id and a.content_type in ('meme','video') and a.is_visible = false and a.is_new = false),
         (select count(*) from public.user_blocks b where b.blocked_id = j.user_id)
  from public.jokes j
  left join public.profiles p on p.id = j.user_id
  where j.content_type in ('meme', 'video') and j.is_visible = false and j.is_new = true
  order by j.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

drop function if exists public.admin_uploaders(text);
create function public.admin_uploaders(p_search text default null)
returns table (
  user_id uuid, display_name text, email text, upload_trusted boolean, uploads_blocked boolean,
  pending_count bigint, approved_count bigint, rejected_count bigint, last_upload timestamptz,
  blocked_by_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
declare q text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_check();
  return query
  select p.id, coalesce(nullif(trim(p.display_name), ''), 'No name'),
         p.email, coalesce(p.upload_trusted, false), coalesce(p.uploads_blocked, false),
         count(j.id) filter (where j.is_visible = false and j.is_new = true),
         count(j.id) filter (where j.is_visible = true),
         count(j.id) filter (where j.is_visible = false and j.is_new = false),
         max(j.created_at),
         (select count(*) from public.user_blocks b where b.blocked_id = p.id)
  from public.profiles p
  left join public.jokes j on j.user_id = p.id and j.content_type in ('meme', 'video')
  where coalesce(p.is_deleted, false) = false
    and ((q is null and (p.upload_trusted or p.uploads_blocked or j.id is not null
                         or exists (select 1 from public.user_blocks b where b.blocked_id = p.id)))
      or (q is not null and (p.email ilike '%' || q || '%' or p.display_name ilike '%' || q || '%')))
  group by p.id
  order by max(j.created_at) desc nulls last, p.display_name
  limit 200;
end;
$$;

revoke all on function public.admin_pending_uploads(integer) from public, anon;
revoke all on function public.admin_uploaders(text) from public, anon;
grant execute on function public.admin_pending_uploads(integer) to authenticated;
grant execute on function public.admin_uploaders(text) to authenticated;
