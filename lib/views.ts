// View counting (MVP). Rules are explained in supabase/views-migration.sql.
//
// Levels sent to the database:
//   0 = shown on screen (jokes, memes, videos: at least half visible for 1 s)
//   1 = video played for 3 seconds
//   2 = video played to half way
//   3 = video played to the end
//
// The phone collects views in a small queue and sends them in one call
// (record_views) every 30 seconds, when 50 are waiting, or when the app goes
// to the background. The server keeps only the highest level per phone,
// item and day, so sending the same thing twice never counts twice.
//
// The phone id is a random id stored on this phone only. It is not linked
// to the person and is only used to count each phone once per item per day.

import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { VideoPlayer } from "expo-video";
import { useEffect, useRef } from "react";
import { AppState, Platform, ViewToken } from "react-native";

import { supabase } from "./supabase";

export type ViewSource = "home" | "favourites" | "profile" | "reel";
export type ViewLevel = 0 | 1 | 2 | 3;

const DEVICE_ID_KEY = "donkey:device-id:v1";
const FLUSH_EVERY_MS = 30000;
const FLUSH_AT = 50;
const MAX_PER_CALL = 100;

let deviceIdPromise: Promise<string> | null = null;
const queue = new Map<string, { level: ViewLevel; source: ViewSource }>();
// Highest level already queued or sent today on this phone (saves calls).
const sentToday = new Map<string, ViewLevel>();
let sentDay = "";
let timer: ReturnType<typeof setInterval> | null = null;
let flushing = false;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function randomId(): string {
  let out = "";
  for (let i = 0; i < 32; i++) out += Math.floor(Math.random() * 16).toString(16);
  return out;
}

function getDeviceId(): Promise<string> {
  if (!deviceIdPromise) {
    deviceIdPromise = (async () => {
      try {
        const saved = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (saved && saved.length >= 16) return saved;
        const fresh = randomId();
        await AsyncStorage.setItem(DEVICE_ID_KEY, fresh);
        return fresh;
      } catch (e) {
        console.log("Failed to load phone id:", e);
        return randomId();
      }
    })();
  }
  return deviceIdPromise;
}

async function flush(): Promise<void> {
  if (flushing || queue.size === 0) return;
  flushing = true;

  const batch = Array.from(queue.entries())
    .slice(0, MAX_PER_CALL)
    .map(([id, v]) => ({ id, level: v.level, source: v.source }));
  batch.forEach((b) => queue.delete(b.id));

  try {
    const deviceId = await getDeviceId();
    const { error } = await supabase.rpc("record_views", {
      p_device_id: deviceId,
      p_items: batch,
      p_platform: Platform.OS,
      p_app_version: Constants.expoConfig?.version ?? null,
    });
    if (error) throw error;
  } catch (e) {
    console.log("Failed to send views:", e);
    // Put them back (unless something higher was queued meanwhile).
    batch.forEach((b) => {
      const waiting = queue.get(b.id);
      if (!waiting || waiting.level < b.level) {
        queue.set(b.id, { level: b.level as ViewLevel, source: b.source });
      }
    });
  } finally {
    flushing = false;
  }

  if (queue.size >= FLUSH_AT) flush();
}

function ensureStarted() {
  if (timer) return;
  timer = setInterval(flush, FLUSH_EVERY_MS);
  AppState.addEventListener("change", (state) => {
    if (state !== "active") flush();
  });
}

// Record that an item reached a level. Safe to call often.
export function recordView(jokeId: string | null | undefined, level: ViewLevel, source: ViewSource) {
  if (!jokeId) return;
  ensureStarted();

  const day = todayUtc();
  if (day !== sentDay) {
    sentDay = day;
    sentToday.clear();
  }

  const already = sentToday.get(jokeId);
  if (already !== undefined && already >= level) return;
  sentToday.set(jokeId, level);

  const waiting = queue.get(jokeId);
  if (!waiting || waiting.level < level) queue.set(jokeId, { level, source });

  if (queue.size >= FLUSH_AT) flush();
}

// Impressions for a feed list: at least half visible for 1 second.
// Used together with the video visibility tracking in lib/video.ts.
export const IMPRESSION_VIEWABILITY = {
  itemVisiblePercentThreshold: 50,
  minimumViewTime: 1000,
};

export function makeImpressionHandler(source: ViewSource) {
  return ({ changed }: { changed: ViewToken[] }) => {
    changed.forEach((token) => {
      const item = token.item;
      if (!token.isViewable || !item || item.isAd || !item.id || !item.content_type) return;
      recordView(String(item.id), 0, source);
    });
  };
}

// Video watch levels: 3 seconds, half way, end.
// Counts time actually played (seeking or skipping does not add time), so a
// looping video reaches "end" once its full length has really been played.
export function useWatchTracking(
  player: VideoPlayer,
  jokeId: string | null | undefined,
  source: ViewSource
) {
  const watchedRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const levelRef = useRef<ViewLevel>(0);

  useEffect(() => {
    watchedRef.current = 0;
    lastTimeRef.current = null;
    levelRef.current = 0;
    if (!jokeId) return;

    // The item was shown and started playing.
    recordView(jokeId, 0, source);

    player.timeUpdateEventInterval = 0.5;

    const sub = player.addListener("timeUpdate", ({ currentTime }) => {
      const last = lastTimeRef.current;
      lastTimeRef.current = currentTime;
      if (last === null || !player.playing) return;

      const step = currentTime - last;
      // Normal playback moves forward a little each update. Bigger jumps
      // (seeking) and going back to the start (looping) add nothing.
      if (step > 0 && step < 1.5) watchedRef.current += step;

      const duration = player.duration;
      const watched = watchedRef.current;
      let level: ViewLevel = 0;
      if (watched >= 3) level = 1;
      if (duration > 0 && watched >= duration * 0.5) level = 2;
      if (duration > 0 && watched >= duration * 0.95) level = 3;
      // Very short videos: half way / end only count after 3 seconds too.
      if (watched < 3) level = 0;

      if (level > levelRef.current) {
        levelRef.current = level;
        recordView(jokeId, level, source);
      }
    });

    return () => sub.remove();
  }, [player, jokeId, source]);
}
