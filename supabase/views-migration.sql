-- ============================================================================
-- Donkey App — VIEW COUNTING (MVP)            Prepared 10 Oct 2026
-- Run once in the Supabase SQL Editor. Undo: supabase/views-rollback.sql
--
-- What counts (rules that can be published to creators):
--   Joke / meme : shown on screen (at least half visible for 1 second) = 1 point
--   Video       : shown on screen                = impression, 0 points
--                 played for 3 seconds           = view,       1 point
--                 played to half way             = 50% view,   3 points
--                 played to the end              = full view,  5 points
--   Only the highest level reached counts (max 5 points per video).
--   Each phone counts each item once per day (UTC). Scrolling back adds nothing.
--   Creators' own views of their own content never count.
--
-- Anti-fake basis (stronger checks can be added later without changing this):
--   - The phone cannot write to the table directly; only record_views() can.
--   - The server checks every item exists, is visible and not flagged, and
--     that only videos can have play levels.
--   - Max 100 items per call, max 2000 items per phone per day.
--   - Every row keeps phone id, signed-in user, platform and app version,
--     and a "verified" flag for the future Apple/Google genuine-app check.
-- Nothing here changes what the live app (2.1.11) receives.
-- ============================================================================

-- 1. One row per day + item + phone, holding the highest level reached.
--    level: 0 = shown, 1 = 3-second view, 2 = 50%, 3 = full (1-3 videos only)
create table if not exists public.content_views (
  day            date        not null default ((now() at time zone 'utc')::date),
  joke_id        uuid        not null references public.jokes(id) on delete cascade,
  device_id      text        not null,
  viewer_user_id uuid        null,
  level          smallint    not null check (level between 0 and 3),
  source         text        not null,
  platform       text        null,
  app_version    text        null,
  verified       boolean     not null default false,
  first_seen     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  primary key (day, joke_id, device_id)
);

create index if not exists content_views_joke_idx   on public.content_views (joke_id);
create index if not exists content_views_device_idx on public.content_views (device_id, day);

-- Locked: nobody reads or writes it directly. Only the functions below.
alter table public.content_views enable row level security;
revoke all on public.content_views from anon, authenticated;

-- 2. Points for one row (single place for the rules above).
create or replace function public.view_points(p_content_type text, p_level smallint)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_content_type = 'video' then
      case p_level when 1 then 1 when 2 then 3 when 3 then 5 else 0 end
    else 1
  end;
$$;

-- 3. The app sends a batch of views here.
--    p_items: [{"id": "<joke id>", "level": 0-3, "source": "home|favourites|profile|reel"}, ...]
--    Returns how many items were accepted.
create or replace function public.record_views(
  p_device_id   text,
  p_items       jsonb,
  p_platform    text default null,
  p_app_version text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_today   date := (now() at time zone 'utc')::date;
  v_used    integer;
  v_room    integer;
  v_done    integer := 0;
begin
  if p_device_id is null or length(p_device_id) < 16 or length(p_device_id) > 64 then
    return 0;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    return 0;
  end if;

  -- Daily limit per phone
  select count(*) into v_used
  from public.content_views
  where day = v_today and device_id = p_device_id;
  v_room := 2000 - v_used;
  if v_room <= 0 then
    return 0;
  end if;

  begin
    with raw as (
      select x.id, x.level, x.source
      from jsonb_to_recordset(p_items) as x(id uuid, level integer, source text)
    ),
    best as (
      -- one entry per item (highest level in this batch)
      select distinct on (id) id, level, source
      from raw
      where id is not null
        and level between 0 and 3
        and source in ('home', 'favourites', 'profile', 'reel')
      order by id, level desc
    ),
    valid as (
      select b.id, b.level::smallint as level, b.source
      from best b
      join public.jokes j on j.id = b.id
      where j.is_visible = true
        and j.is_flagged = false
        and (b.level = 0 or j.content_type = 'video')
        and (v_uid is null or j.user_id is distinct from v_uid)
      limit v_room
    )
    insert into public.content_views
      (day, joke_id, device_id, viewer_user_id, level, source, platform, app_version)
    select v_today, v.id, p_device_id, v_uid, v.level, v.source,
           left(p_platform, 20), left(p_app_version, 20)
    from valid v
    on conflict (day, joke_id, device_id) do update
      set level          = excluded.level,
          source         = excluded.source,
          viewer_user_id = coalesce(public.content_views.viewer_user_id, excluded.viewer_user_id),
          updated_at     = now()
      where excluded.level > public.content_views.level;

    get diagnostics v_done = row_count;
  exception when others then
    -- Bad input (for example an id that is not a valid id): ignore the batch.
    return 0;
  end;

  return v_done;
end;
$$;

revoke all on function public.record_views(text, jsonb, text, text) from public;
grant execute on function public.record_views(text, jsonb, text, text) to anon, authenticated;

-- 4. Admin statistics per item for a date range (admins only).
create or replace function public.get_content_stats(p_from date, p_to date)
returns table (
  joke_id      uuid,
  content_type text,
  preview      text,
  image_path   text,
  created_at   timestamptz,
  creator_id   uuid,
  creator_name text,
  impressions  bigint,
  views_3s     bigint,
  views_half   bigint,
  views_full   bigint,
  points       bigint,
  votes        bigint,
  average      double precision
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    j.id,
    j.content_type,
    left(j.content, 140),
    j.image_path,
    j.created_at,
    j.user_id,
    coalesce(nullif(trim(pp.display_name), ''), 'Anonymous'),
    count(*)::bigint,
    count(*) filter (where v.level >= 1)::bigint,
    count(*) filter (where v.level >= 2)::bigint,
    count(*) filter (where v.level = 3)::bigint,
    sum(public.view_points(j.content_type, v.level))::bigint,
    (j.rating_bad_count + j.rating_meh_count + j.rating_good_count + j.rating_great_count)::bigint,
    -- average rating out of 4 (bad 1, meh 2, good 3, great 4); the old
    -- "average" column is not kept up to date, so it is worked out here.
    case when (j.rating_bad_count + j.rating_meh_count + j.rating_good_count + j.rating_great_count) > 0
      then (j.rating_bad_count * 1 + j.rating_meh_count * 2 + j.rating_good_count * 3 + j.rating_great_count * 4)::double precision
           / (j.rating_bad_count + j.rating_meh_count + j.rating_good_count + j.rating_great_count)
    end
  from public.content_views v
  join public.jokes j on j.id = v.joke_id
  left join public.public_profiles pp on pp.id = j.user_id
  where v.day between p_from and p_to
  group by j.id, j.content_type, j.content, j.image_path, j.created_at, j.user_id, pp.display_name,
           j.rating_bad_count, j.rating_meh_count, j.rating_good_count, j.rating_great_count
  order by 12 desc;
end;
$$;

revoke all on function public.get_content_stats(date, date) from public;
grant execute on function public.get_content_stats(date, date) to authenticated;

-- 5. A creator's own statistics (for a future "My stats" screen).
create or replace function public.get_my_content_stats(p_from date, p_to date)
returns table (
  joke_id      uuid,
  content_type text,
  preview      text,
  impressions  bigint,
  views_3s     bigint,
  views_half   bigint,
  views_full   bigint,
  points       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    j.id,
    j.content_type,
    left(j.content, 140),
    count(*)::bigint,
    count(*) filter (where v.level >= 1)::bigint,
    count(*) filter (where v.level >= 2)::bigint,
    count(*) filter (where v.level = 3)::bigint,
    sum(public.view_points(j.content_type, v.level))::bigint
  from public.content_views v
  join public.jokes j on j.id = v.joke_id
  where auth.uid() is not null
    and j.user_id = auth.uid()
    and v.day between p_from and p_to
  group by j.id, j.content_type, j.content
  order by 8 desc;
$$;

revoke all on function public.get_my_content_stats(date, date) from public;
grant execute on function public.get_my_content_stats(date, date) to authenticated;

-- 6. Day-by-day numbers for charts (admins only).
--    p_joke_id = null gives totals for all content; otherwise one item.
--    The admin page groups days into weeks, months and years itself.
create or replace function public.get_views_daily(p_joke_id uuid, p_from date, p_to date)
returns table (
  day          date,
  impressions  bigint,
  views_3s     bigint,
  views_half   bigint,
  views_full   bigint,
  points       bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ) then
    raise exception 'Not allowed';
  end if;

  return query
  select
    v.day,
    count(*)::bigint,
    count(*) filter (where v.level >= 1)::bigint,
    count(*) filter (where v.level >= 2)::bigint,
    count(*) filter (where v.level = 3)::bigint,
    sum(public.view_points(j.content_type, v.level))::bigint
  from public.content_views v
  join public.jokes j on j.id = v.joke_id
  where v.day between p_from and p_to
    and (p_joke_id is null or v.joke_id = p_joke_id)
  group by v.day
  order by v.day;
end;
$$;

revoke all on function public.get_views_daily(uuid, date, date) from public;
grant execute on function public.get_views_daily(uuid, date, date) to authenticated;

-- 7. One item's details for the admin detail panel (votes per type).
create or replace function public.get_content_item(p_joke_id uuid)
returns table (
  joke_id      uuid,
  content_type text,
  content      text,
  image_path   text,
  video_path   text,
  created_at   timestamptz,
  creator_name text,
  language     text,
  rating_bad   integer,
  rating_meh   integer,
  rating_good  integer,
  rating_great integer,
  report_count integer
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true
  ) then
    raise exception 'Not allowed';
  end if;

  return query
  select j.id, j.content_type, j.content, j.image_path, j.video_path, j.created_at,
         coalesce(nullif(trim(pp.display_name), ''), 'Anonymous'), j.language,
         j.rating_bad_count, j.rating_meh_count, j.rating_good_count, j.rating_great_count,
         j.report_count
  from public.jokes j
  left join public.public_profiles pp on pp.id = j.user_id
  where j.id = p_joke_id;
end;
$$;

revoke all on function public.get_content_item(uuid) from public;
grant execute on function public.get_content_item(uuid) to authenticated;

-- 8. Supabase also grants functions to "anon" directly; signed-out callers
--    never need the statistics functions (they would only get "Not allowed").
revoke execute on function public.get_content_stats(date, date) from anon;
revoke execute on function public.get_views_daily(uuid, date, date) from anon;
revoke execute on function public.get_content_item(uuid) from anon;
revoke execute on function public.get_my_content_stats(date, date) from anon;

-- 9. Creator dashboard in the app (added 10 Oct 2026).
--    Day-by-day numbers for the signed-in creator's own content
--    (p_joke_id = null: all their content; otherwise one of their items).
create or replace function public.get_my_views_daily(p_joke_id uuid, p_from date, p_to date)
returns table (
  day          date,
  impressions  bigint,
  views_3s     bigint,
  views_half   bigint,
  views_full   bigint,
  points       bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    v.day,
    count(*)::bigint,
    count(*) filter (where v.level >= 1)::bigint,
    count(*) filter (where v.level >= 2)::bigint,
    count(*) filter (where v.level = 3)::bigint,
    sum(public.view_points(j.content_type, v.level))::bigint
  from public.content_views v
  join public.jokes j on j.id = v.joke_id
  where auth.uid() is not null
    and j.user_id = auth.uid()
    and v.day between p_from and p_to
    and (p_joke_id is null or v.joke_id = p_joke_id)
  group by v.day
  order by v.day;
$$;

revoke all on function public.get_my_views_daily(uuid, date, date) from public;
revoke execute on function public.get_my_views_daily(uuid, date, date) from anon;
grant execute on function public.get_my_views_daily(uuid, date, date) to authenticated;

--    Total points of ALL content in a period (one number only), so a creator
--    can see their share of the creators' pool.
create or replace function public.get_points_total(p_from date, p_to date)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(public.view_points(j.content_type, v.level)), 0)::bigint
  from public.content_views v
  join public.jokes j on j.id = v.joke_id
  where auth.uid() is not null
    and v.day between p_from and p_to;
$$;

revoke all on function public.get_points_total(date, date) from public;
revoke execute on function public.get_points_total(date, date) from anon;
grant execute on function public.get_points_total(date, date) to authenticated;

-- 10. MVP (10 Oct 2026): creators' OWN views COUNT for now, so statistics can
--     be filled during testing (all memes/videos belong to Andy).
--     Before real payouts, run the original record_views() from step 3 again
--     (it skips own views) together with the planned anti-fake checks.
create or replace function public.record_views(
  p_device_id   text,
  p_items       jsonb,
  p_platform    text default null,
  p_app_version text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid     uuid := auth.uid();
  v_today   date := (now() at time zone 'utc')::date;
  v_used    integer;
  v_room    integer;
  v_done    integer := 0;
begin
  if p_device_id is null or length(p_device_id) < 16 or length(p_device_id) > 64 then
    return 0;
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 100 then
    return 0;
  end if;

  select count(*) into v_used
  from public.content_views
  where day = v_today and device_id = p_device_id;
  v_room := 2000 - v_used;
  if v_room <= 0 then
    return 0;
  end if;

  begin
    with raw as (
      select x.id, x.level, x.source
      from jsonb_to_recordset(p_items) as x(id uuid, level integer, source text)
    ),
    best as (
      select distinct on (id) id, level, source
      from raw
      where id is not null
        and level between 0 and 3
        and source in ('home', 'favourites', 'profile', 'reel')
      order by id, level desc
    ),
    valid as (
      select b.id, b.level::smallint as level, b.source
      from best b
      join public.jokes j on j.id = b.id
      where j.is_visible = true
        and j.is_flagged = false
        and (b.level = 0 or j.content_type = 'video')
      limit v_room
    )
    insert into public.content_views
      (day, joke_id, device_id, viewer_user_id, level, source, platform, app_version)
    select v_today, v.id, p_device_id, v_uid, v.level, v.source,
           left(p_platform, 20), left(p_app_version, 20)
    from valid v
    on conflict (day, joke_id, device_id) do update
      set level          = excluded.level,
          source         = excluded.source,
          viewer_user_id = coalesce(public.content_views.viewer_user_id, excluded.viewer_user_id),
          updated_at     = now()
      where excluded.level > public.content_views.level;

    get diagnostics v_done = row_count;
  exception when others then
    return 0;
  end;

  return v_done;
end;
$$;
