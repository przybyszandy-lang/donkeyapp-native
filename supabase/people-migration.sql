-- People tab (My Profile): my follower / following totals + new followers per day.
-- Only ever about the signed-in user. Unfollows delete rows, so "per day" counts
-- people who still follow you, by the day they started.
create or replace function public.get_my_follow_stats()
returns json
language sql
stable
security definer
set search_path to 'public'
as $$
  select case when auth.uid() is null then null else json_build_object(
    'followers', (select count(*) from follows f join profiles p on p.id = f.follower_id
                   and coalesce(p.is_deleted, false) = false where f.followee_id = auth.uid()),
    'following', (select count(*) from follows f join profiles p on p.id = f.followee_id
                   and coalesce(p.is_deleted, false) = false where f.follower_id = auth.uid()),
    'days', coalesce((
      select json_agg(json_build_object('day', d, 'n', n) order by d)
      from (
        select (f.created_at at time zone 'UTC')::date as d, count(*) as n
        from follows f join profiles p on p.id = f.follower_id and coalesce(p.is_deleted, false) = false
        where f.followee_id = auth.uid()
        group by 1
      ) x), '[]'::json)
  ) end;
$$;

revoke all on function public.get_my_follow_stats() from public, anon;
grant execute on function public.get_my_follow_stats() to authenticated;
