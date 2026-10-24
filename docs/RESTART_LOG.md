# Donkey App — Restart Log

Single source of truth for project state, working rules, environment and latest work.
Paste this whole file at the start of a new session. It is also saved in the app repository at `docs/RESTART_LOG.md` (branch `feature/video`).

**Last updated:** 10 Oct 2026 (end of session)
**Live (store) app:** 2.1.11 build 42 — branch `main`
**Video test app:** version **3.0.0** (renamed from 2.2.0 on 11 Oct — complete remake), build numbers set automatically by EAS — branch `feature/video`
**Master plan for video work:** "Donkey App — Video Support Master Plan" doc on claude.ai: https://claude.ai/code/artifact/010b838f-5881-4843-9ec3-ed3ca71b959a

---

## 1. Working rules (never deviate)

Andy is not a coder. No coding jargon. Never say "add this inside this function" or "delete this function". Say "find this code…", "add this directly below…", "replace this with…".

1. One step at a time. Several steps only if same file and no save needed between them.
2. Never guess code, files, database structure, packages, configuration, build path or device setup. Check or ask.
3. Challenge Andy when he is going the wrong way. Don't just agree.
4. Do not reopen decisions already made unless Andy asks.
5. Build numbers are counted up automatically by EAS (since 11 Oct 2026). Never trust a "prepared, not built" note: before telling Andy to build, check the last number actually uploaded. Only the version (e.g. 2.2.0) is changed by hand, in `app.json`.
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
Version (`expo.version` in `app.json`) is set by hand. Build numbers: `eas.json` has `appVersionSource: "remote"` + `autoIncrement` on production, so EAS gives every build a new number (the `ios.buildNumber` / `android.versionCode` in `app.json` are ignored). Settings "Version" row reads the real installed version and build from the phone (expo-application), so it never needs editing. 11 Oct 2026: build 45 failed on submit because 45 was already on App Store Connect.

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
- `app/(tabs)/my-jokes.tsx` — **My Profile** tab (renamed 11 Oct): tabs **Profile** (`components/profile/MyProfileEditor.tsx`: picture, display name, about me, website, view public profile, Delete Account) / **Dashboard** / **Content**. Own items read from `jokes` (50 per page, incl. content_type, image_path, video_path). Cards show type, status, thumbnail, points/shown/views/votes/rating; filters (All/Jokes/Memes/Videos), sort (Newest/Most points/Most votes); tap → detail. Copy/edit only for jokes; delete or archive as before. Admins see an "Example data" switch (made-up numbers for pitches).
- `components/creator/` — `CreatorDashboard.tsx` (period, tiles, share of all points, chart with metric chips + Day/Week/Month/Year, watch funnel, top 5, content counts, rules), `ContentDetail.tsx` (full-screen item stats), `ui.tsx` (shared pieces). `components/StatsBarChart.tsx` (bar chart from plain views, no new package). `lib/creatorStats.ts` (loading, grouping, example data).
- `app/(tabs)/add-joke.tsx`, `edit-joke.tsx` — joke submission/edit (direct table writes, submitter token).
- `app/(tabs)/settings.tsx` — joke language, **Video sound** switch, dark mode, text size, legal pages, version (read from the phone). Account items moved to My Profile (11 Oct).
- `app/profile/[userId].tsx` — public profile: `components/profile/ProfileHeader.tsx` (picture, name, joined, about me first ~100 chars + more, website, Jokes/Memes/Videos/Votes counts, All/Jokes/Memes/Videos switch) scrolls with the list.
- Feed cards (Home, Favourites): top row `components/profile/CardAuthor.tsx` = picture + name + Follow (anonymous = blank face, no Follow; own posts no Follow). Replaced the "Added by" line. `lib/follows.ts` = shared follow state + card picture cache. `app/follows.tsx` = Followers / Following list. `components/profile/MyEventsEditor.tsx` = events on My Profile.
- `lib/profile.ts` — profile helpers (also social links, camera, events), picture upload (square crop, 512 px JPEG, overwrites `avatars/<user id>/avatar.jpg`), website tidy-up. `components/profile/Avatar.tsx` — round picture or coloured initial.
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
- **Open issue B — FIXED 24 Oct 2026** (`supabase/guard-migration.sql` / `guard-rollback.sql`, trigger `jokes_guard`, tested): app/website users can only insert pending jokes and only change text/language (back to Pending) or archive. Also closed: inserts could be saved already approved / as meme or video. Admin SQL and rate/report functions unaffected. Old note: authenticated users can update every column of their own jokes (policy checks only user_id). Via the API a user could self-approve, set content_type 'meme' (loophole) or 'video' pointing at an existing file, or change counts. Cannot upload files.
- **Agreed:** fix A and B before releasing video (database-only, no app build). First check Add Joke, Edit Joke, My Jokes archive and website anonymous submit so nothing breaks.

### Creator profile (run in Supabase 11 Oct 2026 — `supabase/profile-migration.sql` / `profile-rollback.sql`)
- profiles: `bio` (≤1000), `website` (≤200, must be http/https), `avatar_updated_at` (null = no picture). Users may update these + display_name.
- **Security fix:** users can only insert id/email/display_name/created_at/updated_at (before, a new user could create their own profile as admin). Tested.
- `avatars` bucket: public, 2 MB, JPEG only; each user may only write/replace/delete `<own user id>/avatar.jpg`.
- `get_public_profile(user_id)`: name, bio, website, avatar_updated_at, joined date, joke/meme/video counts, votes received (deleted accounts return nothing).
- `soft_delete_my_account` also clears bio/website/picture; app deletes the picture file first.
- Connector apply_migration was cancelled 3× on 11 Oct; Andy ran the SQL in the SQL Editor instead.

### Social: links, followers, events (run in Supabase 11 Oct 2026 — `supabase/social-migration.sql` / `social-rollback.sql`, tested on local Postgres)
- profiles: `instagram`, `tiktok`, `youtube`, `x_handle`, `facebook` (usernames only, app builds links), `show_followers` / `show_following` (default true; counts always public, lists hidden when off; owner always sees own).
- `follows` table (follower_id, followee_id): changed only via `follow_user` / `unfollow_user` (signed-in, not self, max 5000); users can read their own follow rows. Lists: `get_followers` / `get_following` (50 per page).
- `creator_events` (title ≤80, venue, city, starts_at, ticket_url): owner manages own rows; max 30 upcoming; public via `get_user_events` (shown until 6 h after start).
- `get_profile_cards(ids[])`: profile pictures for feed cards (batched in app).
- `get_public_profile` now also returns socials, followers/following counts, privacy switches, `i_follow`.
- Account delete also removes follows, events, socials.
- **Still to run (optional, 3 lines):** step 8 at the end of social-migration.sql (removes default anon access to follow/unfollow; they already refuse non-signed-in users).

### View counting (installed in Supabase 10 Oct 2026)
- Table `content_views`: one row per day (UTC) + item + phone id, holding the highest level (0 shown, 1 = 3 s, 2 = 50%, 3 = full). Also viewer user, source (home/favourites/profile/reel), platform, app version, `verified` (false; for future Apple/Google genuine-app check). RLS on, no direct access.
- `record_views(device_id, items, platform, app_version)`: only way in. Checks item visible + unflagged, levels 1–3 only for videos, creators' own views excluded, max 100 per call, max 2000 per phone per day.
- Points (`view_points`): joke/meme shown = 1; video 3 s = 1, 50% = 3, full = 5 (highest level only, max 5).
- Admin-only: `get_content_stats(from,to)` (per item, incl. votes + average out of 4 from vote counts — the `average` column is not maintained), `get_views_daily(joke_id or null, from, to)`, `get_content_item(id)`. Creator (app dashboard): `get_my_content_stats(from,to)`, `get_my_views_daily(joke_id or null, from, to)`, `get_points_total(from,to)` (one number, for "your share").
- Business model (MVP, not incorporated yet): gross margin = ad income − direct costs; 70% to creators split by points, 30% Donkey App. Strong anti-fake (App Attest / Play Integrity via Edge Function, held + reviewed payouts) planned before real payouts.
- Tested on a local Postgres copy (dedupe, upgrades, own-view exclusion, admin-only, rollback).
- **MVP change (10 Oct, applied):** creators' own views COUNT for now (step 10 in views-migration.sql) so Andy can fill statistics. Before real payouts: restore the step-3 version (skips own views) + anti-fake checks.

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
1. Build **2.2.0 (45)** (`git pull`, then build + submit; no `npm install` needed). Database side is already done.
2. Test on 45: X/sound hide with overlay; centre play/pause stays paused; Reel ad page after 5 videos; My Jokes Dashboard + My content + item Statistics (real numbers ~30 s after viewing; "Example data" switch for pitches); admin Stats page shows the same views; shared video link on the website plays.
2b. Use the app to fill real statistics (own views count during testing).
3. Security fix for open issues A and B (database only). If column grants are used, include `video_path` (website shared-link page reads it).
4. Android build and test (also check iPad layout).
5. Delete the 5 test videos and files; set final version; merge `feature/video` into `main`; tag `video-v<version>`; submit to stores.
6. Before real creator payouts: restore own-view exclusion (step 3 record_views), add App Attest / Play Integrity check (Edge Function), held + reviewed payouts, Terms update, accountant advice.
6b. **Smarter feed (planned 11 Oct, not started):** weighted random order instead of the plain 6-hour shuffle. Score per item = (1) quality: votes per time shown (😂 +3, 🙂 +2, 😐 0, 😕 −1), new items start at average; (2) freshness boost fading over a few days; (3) ~1 in 5 slots for new / rarely-seen items (fair chance for new creators); (4) skip items this phone saw recently (content_views); (5) followed creators shown more; (6) variety: not two from same creator in a row, mix of types, reported items down. 1–4 + 6 are database-only (no build, could also help live app); 5 needs build 47+. Gap: favourites live only on phones — send favourite counts to the database later.
6c. **Creator uploads (agreed 11 Oct, not started):** (a) FIRST fix open issue B (users can change every field of their own posts). (b) Creator flag on profile, set only by Andy in admin after Content Creator Agreement + identity check. (c) Per-creator setting chosen by Andy: "approval needed" or "publish straight away" (high-profile comedians = straight away). (d) Creators may only add new files to their own folder in memes/videos buckets (no replace/delete). (e) Upload in the app: Add Joke → "Submit a meme or video" opens an uploader for creators (file, description, language); others keep the current message. (f) Pending creator posts appear in admin Approve page; admin page to grant creator status.
7. Later: decide whether to remove the old non-_v2 functions once most users have updated; optional My Jokes "Video" label; consider removing the meme loophole after the security fix.

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

## 11a. Session log — 11 Oct 2026

- Add Joke: confirm box (Go Back / Submit) and language picker now centred on screen for long jokes; new "Submit a meme or video" button with Content Creator Agreement / identity message and link to Contact Us (f6fc12a).
- Build 45 failed on submit (number already used). Fixed for good: EAS raises build numbers automatically; Settings shows the real installed version + build (expo-application, needs `npm install`) (6cae68d). Andy built the next build after that.
- My Jokes → **My Profile** with Profile tab; Settings account section removed; public profile page with header + type switch; profile pictures (new packages: expo-image-picker, expo-image-manipulator, base64-arraybuffer → `npm install` needed). Not built yet.
- Social links, Followers (with privacy switches), Events, card redesign with Follow button, take-or-choose profile photo. New package @react-native-community/datetimepicker. Not built yet.
- Home feed jump after ~50 items fixed (84d5a74): Recently Added + ad slots no longer reshuffle above the reader when the next batch loads. **Not built yet — goes in the next build.**

## 11. Session log — 10 Oct 2026

- Main commits: app `feature/video` b7a06f8 (+ this log); website `main` a5a5867.

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

## 11b. Session log — 24 Oct 2026

- Issue B fixed in database (jokes_guard trigger, applied via connector, tested in a rolled-back transaction).
- User uploads database side applied + tested (`supabase/uploads-migration.sql` / `uploads-rollback.sql`):
  - Meme loophole CLOSED (9 functions + public read rule now need is_visible = true; only 1 old rejected meme was affected).
  - profiles `upload_trusted` (posts go live at once) and `uploads_blocked` — only Andy can set them (SQL / admin).
  - Storage: signed-in users may only ADD files in `u/<user id>/` in memes and videos buckets (no replace/delete/list).
  - `submit_upload(type, file, poster, description, language)` = the only way to create a user meme/video; checks file is theirs, unused, mp4 for video, description ≤100, cap 20 per 24 h; returns pending or published.
  - `archive_my_joke(id)`: My Profile archive was failing (pre-existing); app must call this function (next build).
- App (not built yet): tab **Add Content** (`app/(tabs)/add-content.tsx`) with Add a joke / Add a meme / Add a video; Add Joke page hidden from tab bar, got a Back button, "Submit a meme or video" message removed; Home menu item now "Add Content". New screen `app/upload.tsx` + `lib/uploads.ts`: choose from phone (meme also camera), meme shrunk to JPEG ≤1440 px, iPhone video trimmed to 60 s and shrunk to 540p MP4, preview picture made on the phone, language, description ≤100, "I made this / have permission + Community Guidelines" tick box, manual-approval note. Language list moved to `lib/languages.ts`. My Profile archive now uses `archive_my_joke`. New package **expo-video-thumbnails** → `npm install` needed. app.json: microphone permission text added (was off), photo/camera texts mention memes/videos.
- Android note: no video shrinking on Android yet, so only short clips fit under 25 MB — sort out during Android testing.
- Admin **Review Uploads** page live (website 0fc1c0a, `donkey-admin/review.html`, menu tile): waiting memes/videos oldest first with picture / playable video, description, uploader + history; Approve / Reject / Block buttons; Uploaders tab with search (email/name) and Trusted / Blocked switches. Unlike older admin pages it saves directly through admin-only functions (`supabase/review-migration.sql` / `review-rollback.sql`: admin_check, admin_pending_uploads, admin_review_upload, admin_uploaders, admin_set_uploader — applied + tested). Old Approve page is now for jokes only.
- Rejected uploads keep their files in storage (delete in Supabase dashboard if needed).
- Admin account id is a210e13b-077f-4463-ba58-523dbcdfb1a1 (the 1b01e76f… id above owns the test videos).
- Video limits: **90 s / 50 MB** (free-plan maximum). Videos bucket raised 25 → 50 MB (applied, `supabase/video-limit-50mb.sql`). Admin Add Video same limits, target 20 MB (website 9e58804).
- **Phone shrinks every video before upload** (new packages **react-native-compressor** + **react-native-nitro-modules**, plugin in app.json): MP4, max 720p, max 2.5 Mbit/s, sized to stay under 45 MB (90 s ≈ 30 MB); second smaller try if needed; progress shown. Works on iPhone and Android, so the Android no-shrinking problem is solved. Supabase Pro not needed for file size (may still be needed later for bandwidth).
- Next: build (npm install needed) and test uploads end to end.
- Agreed upload plan (replaces 6c "creators only"): everyone can upload memes/videos; ALL go to manual approval in admin; trusted uploaders (met by Andy in person/Teams) publish straight away; later a paid automatic scanner checks every upload; no small daily limit, only a high safety cap against storage abuse; message telling users approval is manual and may take a while.
- App plan: "Add Joke" tab → "Add Content" with three options: Add a joke (current page, remove the special-account message), Add a meme, Add a video.
