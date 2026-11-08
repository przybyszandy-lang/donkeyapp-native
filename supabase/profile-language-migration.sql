-- profile-language-migration.sql (8 Nov 2026)
-- Profile page language filter: get_profile_jokes_with_name_mixed_v2 also returns each item's language
-- (added as the last column, so older app versions ignore it).

begin;
drop function if exists public.get_profile_jokes_with_name_mixed_v2(uuid);

create function public.get_profile_jokes_with_name_mixed_v2(p_user_id uuid)
returns table(id uuid, content text, created_at timestamp with time zone, average numeric, user_id uuid, display_name text, content_type text, image_path text, video_path text, language text)
language sql
security definer
set search_path = public
as $function$
  select
    j.id,
    j.content,
    j.created_at,
    j.average,
    j.user_id,
    coalesce(pp.display_name, 'User') as display_name,
    coalesce(j.content_type, 'joke') as content_type,
    j.image_path,
    j.video_path,
    j.language
  from public.jokes j
  left join public.public_profiles pp
    on pp.id = j.user_id
  where j.user_id = p_user_id
    and (j.is_visible = true /* meme-loophole-closed */)
    and coalesce(j.content_type, 'joke') in ('joke', 'meme', 'video')
  order by j.created_at desc;
$function$;

grant execute on function public.get_profile_jokes_with_name_mixed_v2(uuid) to anon, authenticated, service_role;
commit;
