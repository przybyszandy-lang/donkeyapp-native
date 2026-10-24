-- Donkey App: admin review of user meme/video uploads — 24 Oct 2026
-- Admin-only functions used by donkey-admin/review.html (website). They write directly
-- (unlike older admin pages that generate SQL) but refuse anyone who is not an admin.
-- Needs uploads-migration.sql first. Undo: supabase/review-rollback.sql

create or replace function public.admin_check()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true) then
    raise exception 'Not allowed';
  end if;
end;
$$;

-- Pending user memes/videos (oldest first, so nobody waits too long)
create or replace function public.admin_pending_uploads(p_limit integer default 50)
returns table (
  id uuid, content_type text, content text, language text, created_at timestamptz,
  image_path text, video_path text, user_id uuid, display_name text, email text,
  upload_trusted boolean, uploads_blocked boolean, approved_count bigint, rejected_count bigint
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
         (select count(*) from public.jokes a where a.user_id = j.user_id
            and a.content_type in ('meme','video') and a.is_visible = true),
         (select count(*) from public.jokes a where a.user_id = j.user_id
            and a.content_type in ('meme','video') and a.is_visible = false and a.is_new = false)
  from public.jokes j
  left join public.profiles p on p.id = j.user_id
  where j.content_type in ('meme', 'video')
    and j.is_visible = false and j.is_new = true
  order by j.created_at asc
  limit greatest(1, least(coalesce(p_limit, 50), 200));
end;
$$;

-- Approve (goes live) or reject (stays hidden, marked "Not approved")
create or replace function public.admin_review_upload(p_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_check();
  update public.jokes
     set is_visible = coalesce(p_approve, false),
         is_new = false,
         updated_at = now()
   where id = p_id and content_type in ('meme', 'video');
  if not found then
    raise exception 'Post not found.';
  end if;
end;
$$;

-- Uploaders list (anyone who uploaded, is trusted or blocked), or search by email / name
create or replace function public.admin_uploaders(p_search text default null)
returns table (
  user_id uuid, display_name text, email text, upload_trusted boolean, uploads_blocked boolean,
  pending_count bigint, approved_count bigint, rejected_count bigint, last_upload timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  q text := nullif(trim(coalesce(p_search, '')), '');
begin
  perform public.admin_check();
  return query
  select p.id,
         coalesce(nullif(trim(p.display_name), ''), 'No name'),
         p.email, coalesce(p.upload_trusted, false), coalesce(p.uploads_blocked, false),
         count(j.id) filter (where j.is_visible = false and j.is_new = true),
         count(j.id) filter (where j.is_visible = true),
         count(j.id) filter (where j.is_visible = false and j.is_new = false),
         max(j.created_at)
  from public.profiles p
  left join public.jokes j on j.user_id = p.id and j.content_type in ('meme', 'video')
  where coalesce(p.is_deleted, false) = false
    and (
      (q is null and (p.upload_trusted or p.uploads_blocked or j.id is not null))
      or (q is not null and (p.email ilike '%' || q || '%' or p.display_name ilike '%' || q || '%'))
    )
  group by p.id
  order by max(j.created_at) desc nulls last, p.display_name
  limit 200;
end;
$$;

create or replace function public.admin_set_uploader(p_user_id uuid, p_trusted boolean, p_blocked boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.admin_check();
  update public.profiles
     set upload_trusted = coalesce(p_trusted, false),
         uploads_blocked = coalesce(p_blocked, false)
   where id = p_user_id;
  if not found then
    raise exception 'User not found.';
  end if;
end;
$$;

revoke all on function public.admin_check() from public, anon;
revoke all on function public.admin_pending_uploads(integer) from public, anon;
revoke all on function public.admin_review_upload(uuid, boolean) from public, anon;
revoke all on function public.admin_uploaders(text) from public, anon;
revoke all on function public.admin_set_uploader(uuid, boolean, boolean) from public, anon;
grant execute on function public.admin_check() to authenticated;
grant execute on function public.admin_pending_uploads(integer) to authenticated;
grant execute on function public.admin_review_upload(uuid, boolean) to authenticated;
grant execute on function public.admin_uploaders(text) to authenticated;
grant execute on function public.admin_set_uploader(uuid, boolean, boolean) to authenticated;
