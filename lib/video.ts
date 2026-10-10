// Shared video helpers.
//
// NORMAL video sound (feed, favourites, profile) is a phone-only preference
// stored in AsyncStorage under VIDEO_SOUND_KEY. It is never sent to Supabase.
// The Settings switch and the speaker icon on feed videos both read and write
// this one value, and broadcast VIDEO_SOUND_EVENT so every screen stays in sync.
//
// REEL mode sound is deliberately NOT stored here. ReelViewer keeps its own
// temporary sound state and never calls saveVideoSound().

import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { AppState, DeviceEventEmitter, ViewToken } from "react-native";

import { IMPRESSION_VIEWABILITY, makeImpressionHandler, ViewSource } from "./views";

export const VIDEO_SOUND_KEY = "donkey:videosound:v1";
export const VIDEO_SOUND_EVENT = "videoSoundChanged";

const VIDEOS_BUCKET_BASE =
  "https://mknsvxajrvdlwqywvlrf.supabase.co/storage/v1/object/public/videos/";

export function videoFileUrl(path?: string | null): string | null {
  if (!path) return null;
  return VIDEOS_BUCKET_BASE + path;
}

export async function loadVideoSound(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(VIDEO_SOUND_KEY);
    return raw === "true";
  } catch (e) {
    console.log("Failed to load video sound setting:", e);
    return false;
  }
}

export async function saveVideoSound(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(VIDEO_SOUND_KEY, String(on));
  } catch (e) {
    console.log("Failed to save video sound setting:", e);
  }
  DeviceEventEmitter.emit(VIDEO_SOUND_EVENT, on);
}

// The current normal (non-Reel) video sound setting, kept in sync everywhere.
export function useVideoSoundSetting(): [boolean, (on: boolean) => void] {
  const [soundOn, setSoundOn] = useState(false);

  useEffect(() => {
    let cancelled = false;

    loadVideoSound().then((value) => {
      if (!cancelled) setSoundOn(value);
    });

    const subscription = DeviceEventEmitter.addListener(
      VIDEO_SOUND_EVENT,
      (value: boolean) => setSoundOn(value === true)
    );

    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);

  const change = (on: boolean) => {
    setSoundOn(on);
    saveVideoSound(on);
  };

  return [soundOn, change];
}

// True while the app is in the foreground. Videos must stop in the background.
export function useAppIsActive(): boolean {
  const [active, setActive] = useState(AppState.currentState === "active");

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      setActive(state === "active");
    });
    return () => subscription.remove();
  }, []);

  return active;
}

// Tracks which video in a list is most visible, so only that one plays,
// and counts impressions (see lib/views.ts) for every joke, meme and video.
// Pass viewabilityConfigCallbackPairs straight to the FlatList.
export function useMostVisibleVideo(source: ViewSource) {
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 60,
    minimumViewTime: 150,
  }).current;

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      const firstVideo = viewableItems.find(
        (token) =>
          token.isViewable &&
          token.item &&
          token.item.content_type === "video" &&
          token.item.video_path
      );
      setActiveVideoId(firstVideo ? String(firstVideo.item.id) : null);
    }
  ).current;

  const viewabilityConfigCallbackPairs = useRef([
    { viewabilityConfig, onViewableItemsChanged },
    {
      viewabilityConfig: IMPRESSION_VIEWABILITY,
      onViewableItemsChanged: makeImpressionHandler(source),
    },
  ]).current;

  return { activeVideoId, viewabilityConfigCallbackPairs };
}

// The information Reel mode needs to show one video.
export type ReelVideo = {
  id: string;
  video_path: string;
  image_path?: string | null;
  user_id?: string | null;
  display_name?: string | null;
  created_at?: string;
  content?: string | null;
};
