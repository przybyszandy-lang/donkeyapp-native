-- Donkey App: backup of database functions BEFORE video work
-- Saved 4 Oct 2026 (pre-video tag: pre-video-v2.1.11, commit 041ea70)
-- Running this file in the Supabase SQL Editor restores these 3 functions exactly as they were.

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
  order by j.created_at desc;
$function$;