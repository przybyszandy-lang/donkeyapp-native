-- Donkey App: jokes guard (fixes open issue B + insert loophole) — 24 Oct 2026
-- Ordinary users (anon / authenticated, not admin) can no longer:
--   * insert a post that is already approved, or is a meme/video, or has counts
--   * change anything on their own post except text + language (an edit sends it back to Pending)
--   * the only other allowed change is "archive" (owner removed, hidden)
-- Values are corrected silently (no errors), so the live app 2.1.11 and the website keep working.
-- Admin portal SQL (run in SQL Editor as postgres) and admins are not affected.
-- Undo: supabase/guard-rollback.sql

create or replace function public.jokes_guard()
returns trigger
language plpgsql
security invoker   -- must run as the caller, so it can tell app users from admin SQL
set search_path = public
as $$
declare
  admin_user boolean := false;
  edited     public.jokes;
begin
  -- only police app/website users
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  select coalesce(p.is_admin, false) into admin_user
  from public.profiles p where p.id = auth.uid();
  if coalesce(admin_user, false) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.content_type       := 'joke';
    new.image_path         := null;
    new.video_path         := null;
    new.is_visible         := false;
    new.is_new             := true;
    new.is_flagged         := false;
    new.rating_bad_count   := 0;
    new.rating_meh_count   := 0;
    new.rating_good_count  := 0;
    new.rating_great_count := 0;
    new.report_count       := 0;
    new.average            := null;
    new.added_by_email     := null;
    new.created_at         := now();
    new.updated_at         := now();
    return new;
  end if;

  -- UPDATE: start from the old row, then apply only allowed changes
  edited := old;

  if new.user_id is null and old.user_id is not null then
    -- archive: owner removed, hidden, not pending
    edited.user_id        := null;
    edited.added_by_email := 'deleted@donkeyapp.com';
    edited.is_visible     := false;
    edited.is_new         := false;
    edited.updated_at     := now();
    return edited;
  end if;

  if new.content is distinct from old.content
     or new.language is distinct from old.language then
    -- edit: new text / language, back to Pending for approval
    edited.content    := new.content;
    edited.language   := new.language;
    edited.is_visible := false;
    edited.is_new     := true;
    edited.updated_at := now();
  end if;

  return edited;
end;
$$;

revoke all on function public.jokes_guard() from public, anon, authenticated;

drop trigger if exists jokes_guard on public.jokes;
create trigger jokes_guard
  before insert or update on public.jokes
  for each row execute function public.jokes_guard();
