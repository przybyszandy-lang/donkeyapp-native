// Shared follow state + profile-picture cache for cards across all screens.
// - Who I follow is loaded once per sign-in and kept in memory; screens listen for changes.
// - Profile pictures for card authors are fetched in batches (get_profile_cards) and cached.
import { useEffect, useState } from "react";
import { Alert, DeviceEventEmitter } from "react-native";

import { supabase } from "./supabase";

export const FOLLOWS_CHANGED_EVENT = "followsChanged";
const AVATARS_CHANGED_EVENT = "cardAvatarsChanged";

let myUserId: string | null = null;
let followingIds = new Set<string>();
let loadedFor: string | null = null;
let loading: Promise<void> | null = null;

async function loadFollowing(userId: string) {
  const { data, error } = await supabase.from("follows").select("followee_id").eq("follower_id", userId);
  if (error) throw error;
  followingIds = new Set((data ?? []).map((r: { followee_id: string }) => r.followee_id));
  loadedFor = userId;
  DeviceEventEmitter.emit(FOLLOWS_CHANGED_EVENT);
}

async function ensureLoaded() {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user?.id ?? null;
  if (uid !== myUserId) {
    myUserId = uid;
    followingIds = new Set();
    loadedFor = null;
    DeviceEventEmitter.emit(FOLLOWS_CHANGED_EVENT);
  }
  if (!uid || loadedFor === uid) return;
  if (!loading) {
    loading = loadFollowing(uid)
      .catch((e) => console.log("Failed to load follows:", e))
      .finally(() => {
        loading = null;
      });
  }
  await loading;
}

supabase.auth.onAuthStateChange(() => {
  ensureLoaded();
});

export function getMyUserId() {
  return myUserId;
}

export function isFollowing(userId: string | null | undefined) {
  return !!userId && followingIds.has(userId);
}

// Follow or unfollow. Shows a sign-in message for people without an account.
// Returns the new state, or null if nothing changed.
export async function toggleFollow(userId: string): Promise<boolean | null> {
  await ensureLoaded();
  if (!myUserId) {
    Alert.alert(
      "Create an account to follow",
      "Following is available for users with an account. Open the menu on the Home screen and choose \"Sign In / Up\" to create a free account."
    );
    return null;
  }
  if (userId === myUserId) return null;

  const wasFollowing = followingIds.has(userId);
  // Update straight away so the button feels instant; undo if the server says no.
  const next = new Set(followingIds);
  if (wasFollowing) next.delete(userId);
  else next.add(userId);
  followingIds = next;
  DeviceEventEmitter.emit(FOLLOWS_CHANGED_EVENT);

  const { error } = await supabase.rpc(wasFollowing ? "unfollow_user" : "follow_user", { p_user_id: userId });
  if (error) {
    console.log("Follow change failed:", error);
    const undo = new Set(followingIds);
    if (wasFollowing) undo.add(userId);
    else undo.delete(userId);
    followingIds = undo;
    DeviceEventEmitter.emit(FOLLOWS_CHANGED_EVENT);
    Alert.alert("Follow", "Something went wrong. Please try again.");
    return null;
  }
  return !wasFollowing;
}

// Re-renders the calling screen whenever follows change; returns my user id.
export function useFollows(): string | null {
  const [, setTick] = useState(0);
  const [uid, setUid] = useState<string | null>(myUserId);
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(FOLLOWS_CHANGED_EVENT, () => {
      setUid(myUserId);
      setTick((t) => t + 1);
    });
    ensureLoaded().then(() => setUid(myUserId));
    return () => sub.remove();
  }, []);
  return uid;
}

// ---------------------------------------------------------------------------
// Profile pictures for cards
// ---------------------------------------------------------------------------

const avatarCache = new Map<string, string | null>(); // user id -> avatar_updated_at (null = none)
const pending = new Set<string>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;

async function flushAvatars() {
  batchTimer = null;
  const ids = Array.from(pending).slice(0, 200);
  ids.forEach((id) => pending.delete(id));
  if (ids.length === 0) return;
  try {
    const { data, error } = await supabase.rpc("get_profile_cards", { p_ids: ids });
    if (error) throw error;
    ids.forEach((id) => avatarCache.set(id, null));
    (data ?? []).forEach((r: { id: string; avatar_updated_at: string | null }) =>
      avatarCache.set(r.id, r.avatar_updated_at)
    );
    DeviceEventEmitter.emit(AVATARS_CHANGED_EVENT);
  } catch (e) {
    console.log("Failed to load profile pictures:", e);
  }
  if (pending.size > 0) batchTimer = setTimeout(flushAvatars, 50);
}

export function setCachedAvatar(userId: string, updatedAt: string | null) {
  avatarCache.set(userId, updatedAt);
  DeviceEventEmitter.emit(AVATARS_CHANGED_EVENT);
}

// Returns avatar_updated_at for a user (undefined while loading).
export function useCardAvatar(userId: string | null | undefined): string | null | undefined {
  const [value, setValue] = useState<string | null | undefined>(
    userId ? avatarCache.get(userId) : null
  );
  useEffect(() => {
    if (!userId) {
      setValue(null);
      return;
    }
    const update = () => setValue(avatarCache.get(userId));
    const sub = DeviceEventEmitter.addListener(AVATARS_CHANGED_EVENT, update);
    if (!avatarCache.has(userId)) {
      pending.add(userId);
      if (!batchTimer) batchTimer = setTimeout(flushAvatars, 50);
    }
    update();
    return () => sub.remove();
  }, [userId]);
  return value;
}
