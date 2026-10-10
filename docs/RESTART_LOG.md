# Donkey App — Restart Log

Single source of truth for project state, working rules, environment and latest work.
Paste this whole file at the start of a new session. It is also saved in the app repository at `docs/RESTART_LOG.md` (branch `feature/video`).

**Last updated:** 10 Oct 2026
**Live (store) app:** 2.1.11 build 42 — branch `main`
**Video test app:** 2.2.0 build 45 prepared (not yet built; now also includes Reel ads + view counting) — branch `feature/video`
**Master plan for video work:** "Donkey App — Video Support Master Plan" doc on claude.ai: https://claude.ai/code/artifact/010b838f-5881-4843-9ec3-ed3ca71b959a

---

## 1. Working rules (never deviate)

Andy is not a coder. No coding jargon. Never say "add this inside this function" or "delete this function". Say "find this code…", "add this directly below…", "replace this with…".

1. One step at a time. Several steps only if same file and no save needed between them.
2. Never guess code, files, database structure, packages, configuration, build path or device setup. Check or ask.
3. Challenge Andy when he is going the wrong way. Don't just agree.
4. Do not reopen decisions already made unless Andy asks.
5. Before any rebuild, raise the version/build number so no two uploads share a number.
6. Say clearly whether to save, commit, or both.
7. Be extremely brief. One sentence, quick decision. Details only if asked.
8. At session end: short progress log + update this file with only the changes actually made.
9. Never put service-role keys or admin credentials in the app or website.
10. Database changes: save the SQL in the repo (`supabase/`) with an undo version. Live app must never receive rows it can't display.
11. EAS is on the **free plan** (limited builds per month): batch app changes into as few builds as possible.

## 2. Confirmed environment

- Windows 11, GitHub Codespaces (browser), real iPhone, no simulator.
- Apple Developer account active. iOS builds via EAS cloud; Andy tests through TestFlight (no Expo Go, no development build).
- Supabase **Free plan**: 5 GB egress + 5 GB cached egress per month, 1 GB file storage, 50 MB max file.

### How Claude works on this project (since 4 Oct 2026)

- **GitHub connected:** Claude can read and push to both repositories:
  - `przybyszandy-lang/donkeyapp-native` (app) — Claude works on branch `feature/video`.
  - `przybyszandy-lang/przybyszandy-lang.github.io` (website + admin) — pushing to `main` publishes live (GitHub Pages + Vercel).
- Claude writes app code, checks it (`npx tsc --noEmit`, `npx eslint`), commits and pushes. Andy then runs `git pull` in the Codespace and builds.
- **Supabase connector:** connected. Read-only queries work. Changes can be applied by Claude with apply_migration (worked 10 Oct); SQL is still saved in the repo with an undo file.
- Expo network calls are blocked in Claude's workspace: install packages with `EXPO_OFFLINE=1 npx expo install <pkg>`.

### Build and test routine (Codespace terminal, on the right branch)

```
git pull
npm install            # only when packages changed
eas build --platform ios --profile production
eas submit --platform ios --latest     # uploads to TestFlight only, NOT App Store review
```
Then install from the TestFlight app. App Store review submission is done manually in App Store Connect.
Version/build live in `app.json` (`expo.version`, `ios.buildNumber`, `android.versionCode`) and the text shown in `app/(tabs)/settings.tsx` ("Version" row). `eas.json` has no auto-increment: raise by hand.

**Branch warning:** the Codespace is currently on `feature/video`. Any urgent fix for the live app must be made on `main` (`git checkout main`), and never built from `feature/video` by mistake.

## 3. Project overview

| Item | Value |
| --- | --- |
| App name / store name | Donkey App / Donkey App Comedy |
| Bundle ID / package | com.donkeyapp.app |
| Expo slug | `donkeyapp-native` (old log said donkeyapp — wrong; do NOT change, EAS depends on it) |
| Scheme | donkeyapp |
| EAS projectId / owner | eb7b5709-70ab-40f4-8191-2ff768086e58 / donkeyappofficial |
| Website | https://www.donkeyapp.com (GitHub Pages, repo przybyszandy-lang.github.io) |
| Admin | https://przybyszandy-lang-github-io.vercel.app/donkey-admin (same repo, Vercel) |
| Supabase project | mknsvxajrvdlwqywvlrf (eu-west-2), Postgres 17 |
| Tech | Expo SDK 54 (~54.0.33), React Native 0.81.5, React 19.1, expo-router 6, new architecture on, React Compiler on, Supabase JS 2 |

Tags/branches: `main` = live app. Tag `pre-video-v2.1.11` (commit 041ea70) = state before video work. Branch `feature/video` = video work.

## 4. App code map (`donkeyapp-native`)

- `app/_layout.tsx` — root Stack in SafeAreaView, splash overlay, AdMob consent.
- `app/(tabs)/_layout.tsx` — tabs: Home, Favourites, Add Joke, My Jokes (settings, edit-joke, explore hidden). Listens to `darkModeChanged`.
- `app/(tabs)/index.tsx` — Home feed. RPC `get_jokes_feed_mixed_v2` (45 rows per load, cursor) + `get_recent_jokes_with_names_mixed_v2` (Recently Added every 3 items). Ads every 6 items (`ADS_ENABLED = true`). Android scroll guard. Menu, search, sign-in modal (email OTP), report modal, meme zoom viewer, videos + Reel.
- `app/(tabs)/favourites.tsx` — favourites from phone storage, RPC `get_favourite_jokes_with_names_mixed_v2`, ads every 7, videos + Reel.
- `app/profile/[userId].tsx` — public profile, RPC `get_profile_jokes_with_name_mixed_v2`, ads every 7, videos + Reel.
- `app/(tabs)/my-jokes.tsx` — creator area (10 Oct): tabs **Dashboard** / **My content**. Own items read from `jokes` (50 per page, incl. content_type, image_path, video_path). Cards show type, status, thumbnail, points/shown/views/votes/rating; filters (All/Jokes/Memes/Videos), sort (Newest/Most points/Most votes); tap → detail. Copy/edit only for jokes; delete or archive as before. Admins see an "Example data" switch (made-up numbers for pitches).
- `components/creator/` — `CreatorDashboard.tsx` (period, tiles, share of all points, chart with metric chips + Day/Week/Month/Year, watch funnel, top 5, content counts, rules), `ContentDetail.tsx` (full-screen item stats), `ui.tsx` (shared pieces). `components/StatsBarChart.tsx` (bar chart from plain views, no new package). `lib/creatorStats.ts` (loading, grouping, example data).
- `app/(tabs)/add-joke.tsx`, `edit-joke.tsx` — joke submission/edit (direct table writes, submitter token).
- `app/(tabs)/settings.tsx` — joke language, **Video sound** switch, dark mode, text size, display name, delete account, legal pages, version text.
- `app/contact-us.tsx` (contact_messages), `delete-account.tsx` (RPC `soft_delete_my_account`), `privacy/terms/guidelines.tsx`.
- `components/FeedAdSlot.native.tsx` / `FeedAdSlot.tsx` — native ad / web-safe empty.
- `components/VideoCard.tsx` — video inside a feed card (4:5 box, poster, description bar, speaker icon; only the active card holds a player).
- `components/ReelViewer.tsx` — full-screen Reel mode (ad page after every 5 videos).
- `components/ReelAdSlot.native.tsx` / `ReelAdSlot.tsx` — full-screen native ad page for Reel (portrait creatives, same ad units) / web-safe empty.
- `lib/views.ts` — view counting: phone id, batching queue, impression handler, `useWatchTracking` (3 s / 50% / full).
- `components/useRetryingPlayer.ts` — video player that retries once without cache on error and shows the real error.
- `lib/video.ts` — Video sound setting, visibility tracking, app-active hook, video URL helper, `ReelVideo` type.
- `lib/jokeActions.ts` — shared favourite / vote / report / share (same keys + RPCs as screens; emits `favouritesChanged` / `votesChanged`).
- `lib/supabase.ts` — public publishable key only (safe), AsyncStorage session on native.
- `supabase/pre-video/functions-backup.sql`, `supabase/video-migration.sql`, `supabase/video-rollback.sql` — database record and undo.
- `supabase/views-migration.sql` / `views-rollback.sql` — view counting (run in Supabase 10 Oct 2026).

**Phone storage keys (AsyncStorage):** `donkey:favourites:v1`, `donkey:votes:v1`, `donkey:language:v1`, `donkey:darkmode:v1`, `donkey:textsize:v1`, `donkey:videosound:v1`, `donkey:language-tutorial-seen:v1`, `donkey:add-joke-language:v1`, `donkey:add-joke-draft:v1`, `donkey:last-submit:v1`, `donkey:submitter-token:v1`, `donkey:device-id:v1` (random phone id for view counting).
**Events:** `darkModeChanged`, `videoSoundChanged`, `favouritesChanged`, `votesChanged`.
**Storage URLs:** memes `…/storage/v1/object/public/memes/<image_path>`; videos and video previews `…/storage/v1/object/public/videos/<path>`.

## 5. Database (Supabase)

### jokes table
Columns: id, created_at, added_by_email, content (required), is_new (default true), is_visible (default **true**), is_flagged, rating_bad/meh/good/great_count, language (default English), submitter_token, average, report_count, user_id, updated_at, content_type (default 'joke'; values 'joke', 'meme', 'video'), image_path, **video_path** (added 4 Oct 2026). Only constraint: primary key. No rule restricting content_type.

Status meaning: Approved = is_visible true; Pending = is_visible false & is_new true; Not approved = is_visible false & is_new false.
Memes and videos are uploaded only by Andy and are saved **already approved** (is_visible true, is_new false). On 4 Oct 2026 the 164 old pending memes were approved; 1 rejected meme left as is.

### Functions (all owner postgres, run with owner rights, search_path=public unless noted)
| Function | Used by | Notes |
| --- | --- | --- |
| get_jokes_feed_mixed | live app 2.1.11, website | jokes + memes only (never videos). Random order reshuffled every 6 h |
| get_recent_jokes_with_names_mixed | live app, website | filter added 4 Oct: jokes + memes only |
| get_favourite_jokes_with_names_mixed | live app, website | no type filter (can't contain videos) |
| get_profile_jokes_with_name_mixed | live app | filter added 4 Oct: jokes + memes only |
| get_profile_jokes_with_name | website userID.html | filter added 4 Oct: jokes + memes only |
| get_jokes_feed_mixed_v2, get_recent_jokes_with_names_mixed_v2, get_favourite_jokes_with_names_mixed_v2, get_profile_jokes_with_name_mixed_v2 | video app | same as above + videos + video_path |
| get_reel_videos(language, limit, after_created_at, after_id) | video app Reel | visible, unflagged videos, newest first; returns content (description) |
| rate_joke, report_joke | all | work for any joke id. rate_joke has no fixed search_path (minor) |
| soft_delete_my_account, get_submission_count, can_submit_joke | app/website | pre-existing |

Meme visibility loophole (pre-existing): old feed/recent/favourite/profile functions and the public read policy show memes even when is_visible = false. Videos do NOT use this loophole.

### Policies / security (checked 4 Oct 2026)
- RLS on: jokes, profiles, joke_reports, contact_messages. `public_profiles` is a safe view (id, display_name, created_at).
- jokes policies: public read of visible jokes or memes; users read/insert/update/delete own rows; anon insert with valid submitter token; admins read all.
- profiles: own row only; is_admin protected from self-update (per earlier log; not re-checked).
- **Open issue A:** the old log's column hardening is NOT active. anon/authenticated have table-wide SELECT on jokes; `submitter_token` readable on 687 visible rows; `added_by_email` readable but empty on all rows.
- **Open issue B:** authenticated users can update every column of their own jokes (policy checks only user_id). Via the API a user could self-approve, set content_type 'meme' (loophole) or 'video' pointing at an existing file, or change counts. Cannot upload files.
- **Agreed:** fix A and B before releasing video (database-only, no app build). First check Add Joke, Edit Joke, My Jokes archive and website anonymous submit so nothing breaks.

### View counting (installed in Supabase 10 Oct 2026)
- Table `content_views`: one row per day (UTC) + item + phone id, holding the highest level (0 shown, 1 = 3 s, 2 = 50%, 3 = full). Also viewer user, source (home/favourites/profile/reel), platform, app version, `verified` (false; for future Apple/Google genuine-app check). RLS on, no direct access.
- `record_views(device_id, items, platform, app_version)`: only way in. Checks item visible + unflagged, levels 1–3 only for videos, creators' own views excluded, max 100 per call, max 2000 per phone per day.
- Points (`view_points`): joke/meme shown = 1; video 3 s = 1, 50% = 3, full = 5 (highest level only, max 5).
- Admin-only: `get_content_stats(from,to)` (per item, incl. votes + average out of 4 from vote counts — the `average` column is not maintained), `get_views_daily(joke_id or null, from, to)`, `get_content_item(id)`. Creator (app dashboard): `get_my_content_stats(from,to)`, `get_my_views_daily(joke_id or null, from, to)`, `get_points_total(from,to)` (one number, for "your share").
- Business model (MVP, not incorporated yet): gross margin = ad income − direct costs; 70% to creators split by points, 30% Donkey App. Strong anti-fake (App Attest / Play Integrity via Edge Function, held + reviewed payouts) planned before real payouts.
- Tested on a local Postgres copy (dedupe, upgrades, own-view exclusion, admin-only, rollback).

### Storage
- `memes` bucket: public, 5 MB, jpeg/png/webp. Policy "Admins can upload memes" (insert, profiles.is_admin).
- `videos` bucket: public, 25 MB (Andy's choice; aim < 8 MB), video/mp4 + image/jpeg. Policy "Admins can upload videos". Files: `videos/<timestamp>_<random>.mp4`, previews `posters/<same>.jpg`.
- No read/update/delete policies: files viewable by link only; delete in Supabase dashboard.

## 6. Admin portal (repo przybyszandy-lang.github.io, folder donkey-admin)

Email OTP login; access only if profiles.is_admin = true. Pages: index (menu), approve, language, add-meme, **add-video**, messages, **stats** (10 Oct). Pages generate SQL that Andy runs in the SQL Editor (they do not write to the jokes table themselves).
- **Add Meme:** uploads images to `memes`; SQL now inserts memes approved (changed 4 Oct).
- **Add Video:** MP4 only, ≤ 60 s, ≤ 25 MB, browser checks it can play; warns over 8 MB; auto preview picture; optional description per video (max 100 characters); SQL inserts approved video rows (content = description). Owner: Andy's user 1b01e76f-daa9-4c21-822b-2a87d390d9e8.
- **Stats:** totals, views-over-time chart (Day/Week/Month/Year + series tick boxes), best performing content (type filter, sort), click item → detail (media, votes, average, funnel, all-time/month/today, own chart), creators share, payout calculator, "Show example data" (made-up numbers for showing creators). Needs views-migration.sql.
- Video prep: HandBrake, preset Fast 720p30, MP4, H.264, target < 8 MB.

Website: `index.html`/`api/devjoke.js` (feed), `favourites.html`, `userID.html`, `joke.html` → rewritten by `vercel.json` to `api/devjoke.js` (shared-link page; memes and, since 10 Oct, **videos**: player with poster, description, buttons; link preview uses the poster). Old language pages (french.html etc.) are unused.

## 7. Video feature — decisions and current behaviour

- A video is a normal jokes row: `content_type = 'video'`, `video_path`, `image_path` = preview picture, `content` = description (may be empty). Same id for votes, reports, favourites, ownership.
- Library: expo-video ~3.0.15 (3.0.16 installed), config plugin added. Players use on-phone caching; retry without cache on error.
- **Feed (Home, Favourites, Profile):** only the most visible video plays (60 % visible); others show the preview. Autoplay muted by default. Pauses when leaving the screen, when a menu/modal/Reel is open, or when the app goes to background. Description on the bottom of the video; no separate text line. Copy button hidden for videos; share text "Check out this video on Donkey App".
- **Video sound setting:** phone only (`donkey:videosound:v1`), default OFF, never stored in Supabase. Settings switch and the speaker icon on feed videos change the same value.
- **Reel mode:** tap a video → full screen, videos only, from `get_reel_videos` (independent of the feed), starts with the tapped video. Every video starts with sound; muting affects only the current video; the next one starts with sound again; never changes the Settings switch. Overlay = close + sound (top), play/pause (centre), "Added by" + description + see-through favourite / vote / report / share (bottom). Overlay hides on tap or after 7 s idle; tap shows it again; while paused it stays up. Centre button pauses until pressed again; holding the video pauses only while held. Closing stops all sound and returns to the same feed position.
- Feed autoplay muted with small files; if bandwidth runs short, upgrade Supabase to Pro (paid from ad income); tap-to-play is the fallback.
- Share links for videos open the website page, which plays the video (done 10 Oct).
- **Reel ads:** full-screen native ad page after every 5 videos (portrait creatives, "Sponsored", close button only). Ad that fails ahead of the user is skipped; if the user is on it, "Swipe up for more videos".
- **View counting:** impressions (≥50% visible for 1 s) in Home/Favourites/Profile; videos also 3 s / 50% / full (time actually played) in feed and Reel. Sent in batches every 30 s / 50 items / on background.
- 5 test videos exist (English, Andy's account, 4 Oct 2026). **Delete them (rows + files) before release.**

## 8. Video project status

| Phase | Status |
| --- | --- |
| 1 Protect current version | Done (tag pre-video-v2.1.11, branch feature/video) |
| 2 Inspect | Done |
| 3 Database + storage | Done (see supabase/video-migration.sql; step 6 = Reel description) |
| 4 Admin | Done (add-video.html with descriptions, menu tile) |
| 5–12 App (feed, sound setting, Reel, favourites, profile, voting, reporting, Home) | Done and tested on 2.2.0 (43) and (44); build 45 changes not yet built |
| 13 Website shared link for videos | Done 10 Oct (live) |
| 14 Testing | In progress |
| 15 Release | Not started |

Test results (build 44, 4 Oct 2026): feed videos, Settings Video sound, speaker icon, Reel with sound, mute-reset per video, close/home-button stop sound, descriptions, overlay auto-hide, Added by, voting, reporting, favourites (feed + Reel), swipe back (fixed), My Jokes text — all OK.

### Next steps (in order)
1. (Done 10 Oct: views-migration.sql applied by Claude via the Supabase connector.)
2. Build **2.2.0 (45)**; test: X/sound hide with overlay, centre play/pause stays paused, My Jokes memes "Approved", Reel ad after 5 videos, admin Stats shows views after ~30 s of use, shared video link on the website.
3. Security fix for open issues A and B (database only). If column grants are used, include `video_path` (website shared-link page reads it).
4. Android build and test (also check iPad layout).
5. Delete the 5 test videos and files; set final version; merge `feature/video` into `main`; tag `video-v<version>`; submit to stores.
6. Later: decide whether to remove the old non-_v2 functions once most users have updated; optional My Jokes "Video" label; consider removing the meme loophole after the security fix.

## 9. Advertising (AdMob)

- Native ads inside feeds: Home every 6 items, Favourites and Profile every 7. `ADS_ENABLED` is currently **true** in all three files (the 2.0.1 release had it false).
- iOS App ID ca-app-pub-3866370568277471~1621348903; Android App ID ca-app-pub-3866370568277471~5935732508; unit ca-app-pub-3866370568277471/6271957624.
- Ad component: `components/FeedAdSlot.native.tsx` (NativeAdView holds all assets; iOS validator issue fixed and confirmed working).
- Website: AdSense applied; cookie consent linked to Google consent mode.

## 10. History (condensed, before 4 Oct 2026)

- Config unified (Donkey App, com.donkeyapp.app); iOS TestFlight + App Store; Android closed testing started (needs 12 testers / 14 days).
- iOS fixes: safe area, navigation taps, date parsing, Settings sign-in refresh, Supabase session persistence.
- Language system: 20 native-name languages, FlatList picker with Save, separate Add Joke language, database migrated to native names; first-run language tutorial.
- Names: Recently Added, Favourites, Profile use Supabase functions returning display_name (no app-side joins).
- Privacy: added_by_email no longer stored; public_profiles view with security_invoker; is_admin protected.
- Admin: OTP login, approve panel (default Approve, SQL generation), language correction panel, Add Meme, messages.
- UI: small-phone vote layout, splash 4.5 s, Favourites back button, scroll indicators hidden, Delete Account only when signed in.
- Website: feed-based redesign mirroring the app, favourites, user pages, About page, legal pages, daily refresh, AdSense readiness.
- 2.0.1 (13) first production release with ads off; later versions up to 2.1.11 (42) are live.

## 11. Session log — 10 Oct 2026

- Website shared-link page shows videos (live, website `main` d72b2d7).
- Reel: full-screen ad page every 5 videos (app d34468b).
- View counting: database SQL + undo (tested locally, not yet run), app counting (5d7c744), admin Stats page with example data (website 3a1380a).
- In-app creator dashboard on My Jokes (+ 2 database functions applied via connector).
- Decisions: points 1/1/3/5, highest level only; build 45 waits so ads + views + dashboard go in one build.

## 12. Session log — 4 Oct 2026

- Created the video master plan; Phase 1 protection; full inspection of app, database, storage, admin and website.
- Database: video_path column; filters on 3 live functions; videos bucket + admin upload rule; 4 _v2 functions + get_reel_videos (later with description); 164 memes approved.
- Admin: Add Video page (+ descriptions), menu tile; Add Meme now saves approved.
- App: expo-video, VideoCard, ReelViewer, Video sound setting, shared joke actions, retrying player, Reel overlay with buttons and pause; versions 2.2.0 (43, 44 built and tested; 45 prepared).
- Security check done; open issues A and B recorded, fix agreed before release.
- GitHub (both repos) and Supabase connected to Claude.
- Last commits: app `feature/video` 39ef2b6 (+ this log); website `main` a3039e7.
