-- Donkey App video project: database and storage changes
-- All run in the Supabase SQL Editor on 4 Oct 2026, in this order. Already applied: do NOT run again.
-- Undo: see supabase/video-rollback.sql

-- STEP 2: new column for the video file location
alter table public.jokes
  add column if not exists video_path text;

-- STEP 3: protect the live app and website (old functions never return videos)
CREATE OR REPLACE FUNCTION public.get_recent_jokes_with_names_mixed(p_language text, p_limit integer)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, language text, average double precision, display_name text, user_id uuid, content_type text, image_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    j.id,
    j.content,
    j.created_at,
    j.language,
    j.average,
    coalesce(pp.display_name, 'Anonymous') as display_name,
    j.user_id,
    coalesce(j.content_type, 'joke') as content_type,
    j.image_path
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
    and j.language = p_language
    and coalesce(j.content_type, 'joke') in ('joke', 'meme')
  order by j.created_at desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_jokes_with_name_mixed(p_user_id uuid)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, average numeric, user_id uuid, display_name text, content_type text, image_path text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    j.id,
    j.content,
    j.created_at,
    j.average,
    j.user_id,
    coalesce(pp.display_name, 'User') as display_name,
    coalesce(j.content_type, 'joke') as content_type,
    j.image_path
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where j.user_id = p_user_id
    and (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
    and coalesce(j.content_type, 'joke') in ('joke', 'meme')
  order by j.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_jokes_with_name(p_user_id uuid)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, average numeric, user_id uuid, display_name text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    j.id,
    j.content,
    j.created_at,
    j.average,
    j.user_id,
    coalesce(pp.display_name, 'User') as display_name
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where j.user_id = p_user_id
    and j.is_visible = true
    and coalesce(j.content_type, 'joke') in ('joke', 'meme')
  order by j.created_at desc;
$function$;

-- STEP 4: videos storage bucket (25 MB limit, MP4 + JPG previews), admin-only upload
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('videos', 'videos', true, 26214400, array['video/mp4', 'image/jpeg']);

create policy "Admins can upload videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'videos'
  and (select profiles.is_admin from public.profiles where profiles.id = auth.uid()) = true
);

-- STEP 5: new functions for the video app only
CREATE OR REPLACE FUNCTION public.get_jokes_feed_mixed_v2(p_limit integer, p_after_created_at timestamp with time zone, p_after_id uuid, p_language text, p_search text)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, language text, average double precision, user_id uuid, display_name text, sort_key text, content_type text, image_path text, video_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
with seed as (
  select to_char(
    date_trunc('hour', now()) - (extract(hour from now())::int % 6) * interval '1 hour',
    'YYYY-MM-DD HH24'
  ) as d
),
ranked as (
  select
    j.id,
    j.content,
    j.created_at,
    j.language,
    coalesce(j.average, 0)::double precision as average,
    j.user_id,
    coalesce(p.display_name, 'Anonymous') as display_name,
    md5(seed.d || ':' || j.id::text) as sort_key,
    coalesce(j.content_type, 'joke') as content_type,
    j.image_path,
    j.video_path
  from public.jokes j
  left join public.public_profiles p on p.id = j.user_id
  cross join seed
  where
    (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
    and j.is_flagged = false
    and j.language = p_language
    and coalesce(j.content_type, 'joke') in ('joke', 'meme', 'video')
    and (coalesce(j.content_type, 'joke') <> 'video' or j.video_path is not null)
    and (
      p_search is null
      or j.content ilike '%' || p_search || '%'
    )
)
select
  r.id, r.content, r.created_at, r.language, r.average, r.user_id,
  r.display_name, r.sort_key, r.content_type, r.image_path, r.video_path
from ranked r
where
  p_after_id is null
  or r.sort_key > (
    select md5(seed.d || ':' || p_after_id::text) from seed
  )
  or (
    r.sort_key = (
      select md5(seed.d || ':' || p_after_id::text) from seed
    )
    and r.id > p_after_id
  )
order by
  r.sort_key asc,
  r.id asc
limit greatest(1, least(p_limit, 200));
$function$;

CREATE OR REPLACE FUNCTION public.get_recent_jokes_with_names_mixed_v2(p_language text, p_limit integer)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, language text, average double precision, display_name text, user_id uuid, content_type text, image_path text, video_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    j.id,
    j.content,
    j.created_at,
    j.language,
    j.average,
    coalesce(pp.display_name, 'Anonymous') as display_name,
    j.user_id,
    coalesce(j.content_type, 'joke') as content_type,
    j.image_path,
    j.video_path
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
    and j.language = p_language
    and coalesce(j.content_type, 'joke') in ('joke', 'meme', 'video')
    and (coalesce(j.content_type, 'joke') <> 'video' or j.video_path is not null)
  order by j.created_at desc
  limit p_limit;
$function$;

CREATE OR REPLACE FUNCTION public.get_favourite_jokes_with_names_mixed_v2(p_ids uuid[])
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, language text, user_id uuid, display_name text, content_type text, image_path text, video_path text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    j.id,
    j.content,
    j.created_at,
    j.language,
    j.user_id,
    coalesce(pp.display_name, 'Anonymous') as display_name,
    coalesce(j.content_type, 'joke') as content_type,
    j.image_path,
    j.video_path
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where j.id = any(p_ids)
    and (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
  order by j.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.get_profile_jokes_with_name_mixed_v2(p_user_id uuid)
 RETURNS TABLE(id uuid, content text, created_at timestamp with time zone, average numeric, user_id uuid, display_name text, content_type text, image_path text, video_path text)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    j.id,
    j.content,
    j.created_at,
    j.average,
    j.user_id,
    coalesce(pp.display_name, 'User') as display_name,
    coalesce(j.content_type, 'joke') as content_type,
    j.image_path,
    j.video_path
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where j.user_id = p_user_id
    and (j.is_visible = true or coalesce(j.content_type, 'joke') = 'meme')
    and coalesce(j.content_type, 'joke') in ('joke', 'meme', 'video')
  order by j.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.get_reel_videos(p_language text, p_limit integer, p_after_created_at timestamp with time zone, p_after_id uuid)
 RETURNS TABLE(id uuid, created_at timestamp with time zone, language text, user_id uuid, display_name text, video_path text, image_path text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select
    j.id,
    j.created_at,
    j.language,
    j.user_id,
    coalesce(pp.display_name, 'Anonymous') as display_name,
    j.video_path,
    j.image_path
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where j.content_type = 'video'
    and j.video_path is not null
    and j.is_visible = true
    and j.is_flagged = false
    and j.language = p_language
    and (
      p_after_created_at is null
      or j.created_at < p_after_created_at
      or (j.created_at = p_after_created_at and j.id < p_after_id)
    )
  order by j.created_at desc, j.id desc
  limit greatest(1, least(p_limit, 50));
$function$;

grant execute on function public.get_jokes_feed_mixed_v2(integer, timestamp with time zone, uuid, text, text) to anon, authenticated;
grant execute on function public.get_recent_jokes_with_names_mixed_v2(text, integer) to anon, authenticated;
grant execute on function public.get_favourite_jokes_with_names_mixed_v2(uuid[]) to anon, authenticated;
grant execute on function public.get_profile_jokes_with_name_mixed_v2(uuid) to anon, authenticated;
grant execute on function public.get_reel_videos(text, integer, timestamp with time zone, uuid) to anon, authenticated;