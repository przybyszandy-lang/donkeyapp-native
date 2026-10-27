# Donkey App — Restart Log

Single source of truth for project state, working rules, environment and latest work.
Paste this whole file at the start of a new session. It is also saved in the app repository at `docs/RESTART_LOG.md` (branch `feature/video`).

**Last updated:** 27 Oct 2026
**Live (store) app:** 2.1.11 build 42 — branch `main`
**Test app:** version **3.0.0** — branch `feature/video`. Build numbers are set automatically by EAS. Andy started the iOS build on 24 Oct with everything below (user uploads, blocking, new Terms + Privacy).
**Master plan for video work:** "Donkey App — Video Support Master Plan" doc on claude.ai: https://claude.ai/code/artifact/010b838f-5881-4843-9ec3-ed3ca71b959a

---

## 1. Working rules (never deviate)

Andy is not a coder. No coding jargon. Never say "add this inside this function" or "delete this function". Say "find this code…", "add this directly below…", "replace this with…".

1. One step at a time. Several steps only if same file and no save needed between them.
2. Never guess code, files, database structure, packages, configuration, build path or device setup. Check or ask.
3. Challenge Andy when he is going the wrong way. Don't just agree.
4. Do not reopen decisions already made unless Andy asks.
5. Build numbers are counted up automatically by EAS (since 11 Oct 2026). Only the version (e.g. 3.0.0) is changed by hand, in `app.json`. A version not yet released to the App Store can take more TestFlight builds.
6. Say clearly whether to save, commit, or both.
7. Be extremely brief. One sentence, quick decision. Details only if asked.
8. At session end: short progress log + update this file with only the changes actually made.
9. Never put service-role keys or admin credentials in the app or website.
10. Database changes: save the SQL in the repo (`supabase/`) with an undo version. Live app must never receive rows it can't display.
11. EAS is on the **free plan** (limited builds per month): batch app changes into as few builds as possible.
12. Deleting data needs Andy's clear yes first.

## 2. Confirmed environment

- Windows 11, GitHub Codespaces (browser), real iPhone, no simulator.
- Apple Developer account active. iOS builds via EAS cloud; Andy tests through TestFlight (no Expo Go, no development build).
- Supabase **Free plan**: 5 GB egress + 5 GB cached egress per month, 1 GB file storage, 50 MB max per file. Andy may move to Pro later for bandwidth.

### How Claude works on this project

- **GitHub connected:** Claude can read and push to both repositories:
  - `przybyszandy-lang/donkeyapp-native` (app) — Claude works on branch `feature/video`.
  - `przybyszandy-lang/przybyszandy-lang.github.io` (website + admin) — pushing to `main` publishes live (GitHub Pages + Vercel).
- Claude writes app code, checks it (`npx tsc --noEmit`, `npx eslint`), commits and pushes. Andy then runs `git pull` in the Codespace and builds.
- **Supabase connector:** connected. Claude reads with execute_sql and applies changes with apply_migration (worked every time on 24 Oct). Changes are first tested inside a transaction that is rolled back. SQL is always saved in the repo with an undo file.
- Expo network calls are blocked in Claude's workspace: install packages with `EXPO_OFFLINE=1 npx expo install <pkg>` (or `npm install`).
- Supabase blocks deleting storage files with SQL: files must be deleted in the dashboard (Storage).

### Build and test routine (Codespace terminal, on the right branch)

```
git pull
npm install            # only when packages changed
eas build --platform ios --profile production
eas submit --platform ios --latest     # uploads to TestFlight only, NOT App Store review
```
Then install from the TestFlight app. App Store review submission is done manually in App Store Connect.
If `git pull` complains about `package-lock.json`, run `git checkout -- package-lock.json` first. Never run `npm audit fix`.
Version (`expo.version` in `app.json`) is set by hand. Build numbers: `eas.json` has `appVersionSource: "remote"` + `autoIncrement` on production. Settings "Version" row reads the real installed version and build from the phone (expo-application).

**Branch warning:** the Codespace is on `feature/video`. Any urgent fix for the live app must be made on `main` (`git checkout main`), and never built from `feature/video` by mistake.

## 3. Project overview

| Item | Value |
| --- | --- |
| App name / store name | Donkey App / Donkey App Comedy |
| Bundle ID / package | com.donkeyapp.app |
| Expo slug | `donkeyapp-native` (do NOT change, EAS depends on it) |
| Scheme | donkeyapp |
| EAS projectId / owner | eb7b5709-70ab-40f4-8191-2ff768086e58 / donkeyappofficial |
| Website | https://www.donkeyapp.com (GitHub Pages, repo przybyszandy-lang.github.io) |
| Admin | https://przybyszandy-lang-github-io.vercel.app/donkey-admin (same repo, Vercel) |
| Supabase project | mknsvxajrvdlwqywvlrf (eu-west-2 London), Postgres 17 |
| Andy's admin account | a210e13b-077f-4463-ba58-523dbcdfb1a1 (profiles.is_admin = true) |
| Account that owns Andy's videos | 1b01e76f-daa9-4c21-822b-2a87d390d9e8 |
| Tech | Expo SDK 54 (~54.0.33), React Native 0.81.5, React 19.1, expo-router 6, new architecture on, React Compiler on, Supabase JS 2 |

Tags/branches: `main` = live app. Tag `pre-video-v2.1.11` (commit 041ea70) = state before video work. Branch `feature/video` = all new work (version 3.0.0).

## 4. App code map (`donkeyapp-native`)

**Tabs** (`app/(tabs)/_layout.tsx`): Home, Favourites, **Add Content**, **My Profile**. Hidden: add-joke, edit-joke, settings, explore. Listens to `darkModeChanged`.

- `app/_layout.tsx` — root Stack in SafeAreaView, splash overlay, AdMob consent (UMP form).
- `app/(tabs)/index.tsx` — Home feed. RPC `get_jokes_feed_mixed_v2` (45 rows per load, cursor) + `get_recent_jokes_with_names_mixed_v2` (Recently Added every 3 items). Ads every 6 items. Feed built batch by batch so it doesn't jump. Hides blocked users / hidden posts. Menu (item "Add Content"), search, sign-in modal (email OTP), report modal, meme zoom, videos + Reel.
- `app/(tabs)/favourites.tsx` — favourites from phone storage, RPC `get_favourite_jokes_with_names_mixed_v2`, ads every 7, videos + Reel, hides blocked.
- `app/profile/[userId].tsx` — public profile: `components/profile/ProfileHeader.tsx` (picture, name, joined, about me, website, socials, counts, followers, events, Follow, **Block / Unblock**, type switch). RPC `get_profile_jokes_with_name_mixed_v2`, ads every 7. Blocked profile shows no posts.
- `app/(tabs)/add-content.tsx` — **Add Content**: Add a joke / Add a meme / Add a video + "checked by hand" note.
- `app/(tabs)/add-joke.tsx` — joke submission (unchanged except a "← Back" to Add Content; creator message removed). `edit-joke.tsx` — edit own joke.
- `app/upload.tsx` (`?type=meme|video`) + `lib/uploads.ts` — upload screen: sign-in needed; choose from phone (meme also camera); meme → JPEG ≤1440 px ≤5 MB; video → iPhone trim to 90 s, then **shrunk on the phone** with react-native-compressor (MP4, max 720p, max 2.5 Mbit/s, sized under 45 MB, second smaller try, progress "Shrinking your video… %"); preview picture made with expo-video-thumbnails; language; description ≤100; tick box "18 or over / made it or have permission incl. people shown / Terms + Guidelines"; files to `u/<user id>/<time>_<random>.jpg|.mp4`; then RPC `submit_upload` → "pending" or "published".
- `app/(tabs)/my-jokes.tsx` — **My Profile**: tabs Profile (`components/profile/MyProfileEditor.tsx`: picture, name, about me, website, socials, events, Delete Account) / Dashboard / Content (own items incl. pending memes/videos, filters, sort, detail). Archive of popular jokes uses RPC `archive_my_joke`.
- `components/creator/` — `CreatorDashboard.tsx`, `ContentDetail.tsx`, `ui.tsx`; `components/StatsBarChart.tsx`; `lib/creatorStats.ts`.
- `app/(tabs)/settings.tsx` — joke language, Video sound, dark mode, text size, **Blocked users**, legal pages, Contact Us, version.
- `app/blocked.tsx` — Blocked users list (Unblock) + hidden posts ("Show again").
- `lib/blocks.ts` — blocking + hiding (phone lists, `record_block` to database, "⋯" menu, confirm, `useBlocks` hook).
- `components/profile/CardAuthor.tsx` — top row of feed cards: picture + name + Follow + **"⋯"** (Block <name> / Hide this post; not on own posts).
- `lib/follows.ts` (follow state, card picture cache, `forgetFollow`), `app/follows.tsx` (Followers / Following), `lib/profile.ts`, `components/profile/Avatar.tsx`, `MyEventsEditor.tsx`.
- `app/terms.tsx`, `app/privacy.tsx` → `components/legal/LegalScreen.tsx`, text from `lib/terms.json` / `lib/privacy.json` (same text as website). `app/guidelines.tsx` (not yet updated for memes/videos).
- `lib/languages.ts` — the 20 languages (shared by Add Joke and Upload).
- `app/contact-us.tsx` (contact_messages), `delete-account.tsx` (RPC `soft_delete_my_account`).
- `components/FeedAdSlot.native.tsx` / `FeedAdSlot.tsx`, `components/ReelAdSlot.native.tsx` / `ReelAdSlot.tsx` — ads.
- `components/VideoCard.tsx`, `components/ReelViewer.tsx` (skips blocked users' videos), `components/useRetryingPlayer.ts`, `lib/video.ts`.
- `lib/views.ts` — view counting + `getDeviceId()` (random phone id).
- `lib/jokeActions.ts` — favourite / vote / report / share.
- `lib/supabase.ts` — publishable key only, AsyncStorage session.
- `scripts/build-web-legal.py` — rebuilds website legal pages from the json files (see section 10).

**Packages added for 3.0.0:** expo-image-picker, expo-image-manipulator, base64-arraybuffer, @react-native-community/datetimepicker, expo-application, expo-video-thumbnails, react-native-compressor + react-native-nitro-modules (plugin in app.json). app.json permission texts: photos, camera, **microphone** (needed to record video).

**Phone storage keys (AsyncStorage):** `donkey:favourites:v1`, `donkey:votes:v1`, `donkey:language:v1`, `donkey:darkmode:v1`, `donkey:textsize:v1`, `donkey:videosound:v1`, `donkey:language-tutorial-seen:v1`, `donkey:add-joke-language:v1`, `donkey:add-joke-draft:v1`, `donkey:last-submit:v1`, `donkey:submitter-token:v1`, `donkey:device-id:v1`, `donkey:blocked-users:v1`, `donkey:hidden-posts:v1`.
**Events:** `darkModeChanged`, `videoSoundChanged`, `favouritesChanged`, `votesChanged`, `followsChanged`, `cardAvatarsChanged`, `blocksChanged`.
**Storage URLs:** memes `…/storage/v1/object/public/memes/<image_path>`; videos and video previews `…/storage/v1/object/public/videos/<path>`; avatars `…/avatars/<user id>/avatar.jpg`.

## 5. Database (Supabase)

### jokes table
Columns: id, created_at, added_by_email, content (required), is_new, is_visible (default true), is_flagged, rating_bad/meh/good/great_count, language, submitter_token, average, report_count, user_id, updated_at, content_type ('joke' / 'meme' / 'video'), image_path, video_path.
Status: Approved = is_visible true; Pending = is_visible false & is_new true; Not approved = is_visible false & is_new false.
A video row: `video_path` = MP4, `image_path` = preview picture, `content` = description (may be empty).
4 videos exist (Andy's, 10–11 Oct). The 5 test videos were deleted 24 Oct (rows, views, reports); their 10 files remain in storage but are never shown (optional dashboard clean-up: names starting 1791125380734, 1791125381325, 1791125381765, 1791143738106, 1791143738529).

### Protection of the jokes table
- **Trigger `jokes_guard`** (`supabase/guard-migration.sql` / `guard-rollback.sql`, 24 Oct): for app/website users (not admins, not SQL Editor) inserts are always pending jokes (type joke, no files, zero counts); updates can only change text + language (goes back to Pending) or archive. Fixes old **issue B**.
- **Meme loophole closed** (24 Oct): all feed/recent/favourite/profile functions and the public read rule now need `is_visible = true` (marked `/* meme-loophole-closed */` in the functions).
- Policies: public read of visible rows; users read/insert/update/delete own rows; anon insert with valid submitter token; admins read all.
- **Open issue A (still open):** anon/authenticated can read every column of visible jokes, so `submitter_token` is readable (added_by_email empty). Fix with column grants (include `video_path`, website reads it).

### Functions (main ones)
| Function | Used by | Notes |
| --- | --- | --- |
| get_jokes_feed_mixed, get_recent_jokes_with_names_mixed, get_favourite_jokes_with_names_mixed, get_profile_jokes_with_name_mixed, get_profile_jokes_with_name | live app 2.1.11, website | jokes + memes only, visible only |
| *_v2 versions of the four above | app 3.0.0 | + videos + video_path |
| get_reel_videos | Reel | visible, unflagged videos, newest first |
| rate_joke, report_joke | all | counts only (who voted/reported not stored). No auto-hide after reports |
| submit_upload(type, file, poster, description, language) | upload screen | only way for users to create memes/videos; file must be theirs in `u/<uid>/`, unused, MP4 for video; description ≤100; cap 20 per 24 h; trusted → live, others → pending; blocked uploaders refused |
| archive_my_joke(id) | My Profile | hides + removes owner of own popular joke (old direct update was refused) |
| record_block(device_id, blocked_id, blocked) | blocking | saves/removes block in `user_blocks`; signed-in blocker loses follows both ways |
| admin_check, admin_pending_uploads, admin_review_upload, admin_uploaders, admin_set_uploader | admin Review Uploads | admin-only; lists include blocked_by_count |
| record_views + stats functions | views / dashboards | see View counting |
| soft_delete_my_account, get_submission_count, can_submit_joke, get_public_profile, get_profile_cards, follow/unfollow, get_followers/following, get_user_events | app/website | |

### Profiles, social, uploads
- profiles: display_name, bio, website, avatar_updated_at, socials (instagram, tiktok, youtube, x_handle, facebook), show_followers / show_following, is_admin, is_deleted, **upload_trusted**, **uploads_blocked**. Users can only update named columns (not is_admin / trusted / blocked).
- `follows`, `creator_events`, `user_blocks` (phone id + blocked user + optional blocker account; no direct access).
- **Still to run (optional, 3 lines):** step 8 at the end of social-migration.sql.

### Storage
- `memes`: public, 5 MB, jpeg/png/webp. Admin upload anywhere; **users add-only in `u/<own id>/`**.
- `videos`: public, **50 MB** (24 Oct, `supabase/video-limit-50mb.sql`), video/mp4 + image/jpeg. Admin files `videos/…mp4` + `posters/…jpg`; **users add-only in `u/<own id>/`**.
- `avatars`: public, 2 MB, JPEG; each user only `<own id>/avatar.jpg`.
- No user replace/delete; rejected uploads keep their files (delete in dashboard if needed). Uploading blocked if `uploads_blocked`.

### View counting (since 10 Oct)
- `content_views`: one row per day + item + phone id, highest level (0 shown, 1 = 3 s, 2 = 50%, 3 = full), viewer user, source, platform, app version, `verified`.
- Points: joke/meme shown = 1; video 3 s = 1, 50% = 3, full = 5.
- **MVP setting:** creators' own views COUNT for now. Before real payouts: restore own-view exclusion + App Attest / Play Integrity.
- Business model idea (not promised to users): gross margin = ad income − direct costs; 70% creators by points, 30% Donkey App.

### SQL files in repo (`supabase/`, each with undo)
video-migration, views-migration, profile-migration, social-migration, **guard-migration**, **uploads-migration**, **review-migration**, **blocks-migration**, **video-limit-50mb** (24 Oct ones applied + tested).

## 6. Admin portal (repo przybyszandy-lang.github.io, folder donkey-admin)

Email OTP login; access only if profiles.is_admin = true. Menu tiles: Moderation (approve, **jokes only**), **Review Uploads**, Language, Add Meme, Add Video, Content Stats, Messages.
- **Review Uploads** (`review.html`, 24 Oct): saves directly via admin-only functions (no SQL copying). Tab "Waiting for approval": memes/videos oldest first, picture / playable video, description, language, uploader name + email, trusted/blocked badge, past approved/rejected, **blocked by N people** (red); buttons Approve / Reject / Block this uploader. Tab "Uploaders": search email/name; columns waiting/approved/rejected/last upload/**Blocked by**; switches **Trusted** (confirm: goes live without approval) and **Blocked**.
- **Approve** (jokes), **Language**, **Add Meme**, **Messages**: generate SQL that Andy runs in the SQL Editor.
- **Add Video:** MP4, ≤ 90 s, ≤ 50 MB, warns over 20 MB, auto preview, description ≤100; SQL inserts approved rows (owner 1b01e76f…). Video prep: HandBrake Fast 720p30.
- **Stats:** views, points, best content, detail, creator share, payout calculator, example data.

Website: `index.html`/`api/devjoke.js` (feed), `favourites.html`, `userID.html?userId=`, `joke.html` → `api/devjoke.js` (shared links incl. videos). Legal: `conditions.html` (most links), `terms.html`, `privacy.html`, `guidelines.html`. Website has no meme/video upload (app only).

## 7. Content rules (as built 24 Oct)

- **Jokes:** anyone, no account needed (app or website; shown as Anonymous). Always wait for approval (Approve page).
- **Memes and videos:** account required, app only. Tick box: 18+ (self-declared), own it / have permission, follows Terms + Guidelines. All wait for approval in **Review Uploads**, except **trusted** uploaders (Andy marks them after meeting in person / Teams) who go live straight away. **Blocked** uploaders cannot upload. Limits: video 90 s, under 50 MB after shrinking; max 20 uploads per person per 24 h.
- Agreed plan: manual approval for all now; later a paid automatic scanner (nudity/violence) checks every upload.

## 8. Blocking (24 Oct)

Personal, this phone only (others still see the person). "⋯" on feed cards → Block <name> (confirm; removes follows both ways if signed in) or Hide this post (works for anonymous jokes). Profile page: Block / "You blocked … Unblock". Hidden on Home, Recently Added, Favourites, profiles, Reel. Settings → Blocked users to unblock / show hidden posts again. Each block is recorded (phone id) so admin sees "blocked by" counts. Required by Apple for apps with user uploads.

## 9. Video feature — behaviour

- Feed (Home, Favourites, Profile): most visible video plays muted (sound setting default off); others show preview; pauses off-screen / menus / background. Speaker icon = same as Settings Video sound.
- Reel: tap a video → full screen, videos only (`get_reel_videos`), each starts with sound, overlay with close/sound/play-pause/Added by/description/buttons, auto-hide 7 s; ad page every 5 videos.
- Share links open the website video page. View counting in feed and Reel (impressions, 3 s / 50% / full), sent in batches.

## 10. Legal pages (24 Oct)

- One text for app and website: `lib/terms.json`, `lib/privacy.json`. After changing a json file, rebuild the website pages:
  `python3 scripts/build-web-legal.py lib/terms.json ../przybyszandy-lang.github.io/conditions.html` (and `terms.html`), `python3 scripts/build-web-legal.py lib/privacy.json ../przybyszandy-lang.github.io/privacy.html`, then push the website.
- **Terms:** 13+ (under 18 with parent permission), uploads 18+, manual approval, trusted uploaders, zero-tolerance banned list (nudity/sexual, children, violence/self-harm, hate, harassment, people without consent, others' material, deepfakes, illegal, spam), licence incl. technical changes, removal + popular jokes kept anonymously, copyright notices, complaints, enforcement, **no payments now — possible future revenue sharing under separate terms**, liability, England & Wales law.
- **Privacy:** account, profile, uploads, phone ID + view counting, blocks, phone-only data, AdMob/AdSense/Analytics with consent, lawful bases, who sees what, providers (Supabase London, Google, Vercel, GitHub Pages), retention, deletion (72 h), children, UK rights + ICO, security.
- To do: add the legal owner's name (Andy personally or a company) as data controller; solicitor review before payouts.

## 11. Status and next steps

| Area | Status |
| --- | --- |
| Video phases 1–13 (database, admin, app, Reel, website links) | Done |
| Profiles, followers, events, card redesign (11 Oct) | Built and tested |
| User uploads, Review Uploads, blocking, new legal pages (24 Oct) | Database + website live; app in build 3.0.0 started 24 Oct |
| Testing | In progress |
| Release | Not started |

### Next steps (in order)
1. Finish the iOS build, then `eas submit --platform ios --latest`, install from TestFlight.
2. Test: Add Content tab (3 options; Add Joke Back button); upload a meme (library + camera) and a video (trim, shrinking progress, preview) → shows **Pending** in My Profile → Content; approve/reject in **Review Uploads** → appears / stays hidden; mark yourself Trusted → next upload goes live straight away; Blocked → upload refused. Block a user from "⋯" and from a profile → posts vanish; Settings → Blocked users → Unblock; Hide this post on an anonymous joke → Show again. Archive a popular joke in My Profile (now works). Terms + Privacy pages in app match website. Also still to check from earlier: Reel ad after 5 videos, dashboard numbers, admin Stats.
3. Fix security **issue A** (column grants; keep `video_path` readable).
4. Update Community Guidelines (app + website) for memes and videos (same banned list as Terms) — consider making it a json file like the Terms.
5. Android build and test (video shrinking, upload, blocking; iPad layout too).
6. Release: set final version, merge `feature/video` into `main`, tag `video-v<version>`, submit to stores.
7. Before real creator payouts: restore own-view exclusion, App Attest / Play Integrity check, held + reviewed payouts, separate creator payment terms, solicitor + accountant advice.
8. Later: paid automatic upload scanner; auto-hide after several reports; Block / Hide inside Reel; smarter feed (weighted order, plan from 11 Oct: quality, freshness, fair chance for new items, skip recently seen, followed creators more, variety); remove old non-_v2 functions once most users updated; Supabase Pro if bandwidth runs short.

## 12. Advertising (AdMob)

- Native ads: Home every 6 items, Favourites and Profile every 7, Reel full-screen ad every 5 videos. `ADS_ENABLED = true`.
- iOS App ID ca-app-pub-3866370568277471~1621348903; Android App ID ca-app-pub-3866370568277471~5935732508; unit ca-app-pub-3866370568277471/6271957624.
- Website: AdSense, cookie consent linked to Google consent mode.

## 13. History (condensed)

- Before 4 Oct: config unified; iOS live (2.0.1 first release, up to 2.1.11 build 42); Android closed testing started; language system (20 languages); names via database functions; privacy fixes; admin portal; website redesign.
- 4 Oct: video master plan; video_path column, videos bucket, _v2 functions, Reel; admin Add Video; 164 memes approved; security issues A + B found.
- 10 Oct: website video share page; Reel ads; view counting + admin Stats; creator dashboard.
- 11 Oct: version 3.0.0; EAS auto build numbers; My Profile with Profile tab; public profiles, pictures, socials, followers, events, Follow on cards; feed jump fixed.

## 14. Session log — 24 Oct 2026

- Issue B fixed (jokes_guard trigger); meme loophole closed.
- User uploads: database (submit_upload, storage folders, trusted/blocked flags, archive_my_joke), app (Add Content tab, upload screen, phone video shrinking, 90 s / 50 MB), admin Review Uploads page; videos bucket 50 MB.
- Blocking users / hiding posts (app + record_block + admin counts).
- New Terms and Privacy Policy, shared text for app and website (terms.html, conditions.html, privacy.html live).
- 5 test videos deleted from database.
- Last commits: app `feature/video` (this log); website `main` be5f197.

## 15. Session log — 27 Oct 2026

- Removed all payout wording from the app (My Profile → Dashboard): Points tile now says "from views of your posts"; "Your share" card shows share of points only (no ad profit / pool text). Terms keep the "possible future revenue sharing" line. Needs the next app build.
- Follow button fixed: taps were saving (database fine) but the button never changed to "Following" because the React Compiler kept the old answer. New `useIsFollowing` hook in `lib/follows.ts`, used by `CardAuthor.tsx` and `ProfileHeader.tsx`. Signed-out users still get the "Create an account to follow" message. Favourites unchanged (phone only).
- Same hidden fault fixed for blocking: `isUserBlocked`, `getBlockedUsers`, `hiddenPostCount` now take the `useBlocks()` number (profile page, ProfileHeader, Blocked users screen).
- Both need the next app build.
- **My Profile tabs now: Profile / People / Dashboard / Content** (Content without the number). New `components/creator/PeopleTab.tsx`: tiles Followers, New this week (7 days), Following, New followers (chosen period); "New followers" chart (7/30/90/All, Day/Week/Month/Year); list switch Followers / Following with picture, name, "since" date, Follow button, Show more. Owner always sees both lists; public visibility still set by the Profile tab switches. Refreshes on any follow change.
- Database: new function `get_my_follow_stats()` (signed-in user only; totals + new followers per day; counts people who still follow). File `supabase/people-migration.sql` + `people-rollback.sql`. **Applied 27 Oct + tested.** Unfollows are not recorded, so "lost followers" can't be shown.
- Wording: Home menu item "My Jokes" → "My Content"; "Go to My Jokes" buttons (Add Joke, Edit Joke) → "Go to My Content"; signed-out title on My Profile screen → "My Profile".
- Terms (27 Oct, app `lib/terms.json` + website terms.html / conditions.html): provider "Andrzej Przybysz", contact andy@donkeyapp.com (intro + section 19); section 6 says uploads are checked by hand to comply with our Online Safety Act risk assessment, linking donkeyapp.com/risk_assessment.html. `build-web-legal.py` now links that address and the email.
- **Risk assessment:** full internal version = claude.ai doc "Donkey App — Online Safety Risk Assessments" https://claude.ai/artifact/HjfvVEyaiFqRBzb4covgs9 (includes action plan). Public version (no action plan) = website `risk_assessment.html`, noindex/nofollow, not in sitemap. Still to do from action plan: user numbers, check profile pictures/text, "Report profile" + auto-hide, Guidelines update, report log, solicitor review. Privacy Policy still needs Andrzej Przybysz named as data controller.
