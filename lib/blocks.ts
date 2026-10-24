// Blocking users and hiding posts. Personal only: hides things on this phone, for everyone
// else nothing changes. Lists live on the phone (like favourites), so it works signed out too.
// Each block is also recorded in the database (record_block) so Andy can see in admin how many
// people blocked someone; a signed-in blocker also loses any follow between the two of them.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useState } from "react";
import { Alert, DeviceEventEmitter } from "react-native";

import { forgetFollow } from "./follows";
import { supabase } from "./supabase";
import { getDeviceId } from "./views";

const BLOCKED_USERS_KEY = "donkey:blocked-users:v1";
const HIDDEN_POSTS_KEY = "donkey:hidden-posts:v1";
export const BLOCKS_CHANGED_EVENT = "blocksChanged";

export type BlockedUser = { id: string; name: string; at: string };

let blockedUsers: BlockedUser[] = [];
let blockedIds = new Set<string>();
let hiddenPosts = new Set<string>();
let loaded = false;
let loading: Promise<void> | null = null;
let version = 0;

function changed() {
  version += 1;
  blockedIds = new Set(blockedUsers.map((u) => u.id));
  DeviceEventEmitter.emit(BLOCKS_CHANGED_EVENT, version);
}

export function loadBlocks(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      try {
        const [rawUsers, rawPosts] = await Promise.all([
          AsyncStorage.getItem(BLOCKED_USERS_KEY),
          AsyncStorage.getItem(HIDDEN_POSTS_KEY),
        ]);
        const users = rawUsers ? JSON.parse(rawUsers) : [];
        const posts = rawPosts ? JSON.parse(rawPosts) : [];
        blockedUsers = Array.isArray(users) ? users.filter((u) => u && typeof u.id === "string") : [];
        hiddenPosts = new Set(Array.isArray(posts) ? posts.filter((p) => typeof p === "string") : []);
      } catch (e) {
        console.log("Failed to load blocks:", e);
      }
      loaded = true;
      changed();
    })();
  }
  return loading;
}

async function save() {
  try {
    await AsyncStorage.multiSet([
      [BLOCKED_USERS_KEY, JSON.stringify(blockedUsers)],
      [HIDDEN_POSTS_KEY, JSON.stringify([...hiddenPosts].slice(-2000))],
    ]);
  } catch (e) {
    console.log("Failed to save blocks:", e);
  }
}

async function tellServer(userId: string, blocked: boolean) {
  try {
    const deviceId = await getDeviceId();
    const { error } = await supabase.rpc("record_block", {
      p_device_id: deviceId,
      p_blocked_id: userId,
      p_blocked: blocked,
    });
    if (error) console.log("record_block failed:", error);
  } catch (e) {
    console.log("record_block failed:", e);
  }
}

export function isUserBlocked(userId: string | null | undefined) {
  return !!userId && blockedIds.has(userId);
}

// True when a post should not be shown on this phone.
export function isHiddenPost(item: { id: string; user_id?: string | null } | null | undefined) {
  if (!item) return false;
  return hiddenPosts.has(item.id) || isUserBlocked(item.user_id);
}

export function getBlockedUsers(): BlockedUser[] {
  return [...blockedUsers].sort((a, b) => b.at.localeCompare(a.at));
}

export async function blockUser(userId: string, name: string) {
  await loadBlocks();
  if (blockedIds.has(userId)) return;
  blockedUsers = [...blockedUsers, { id: userId, name: name || "User", at: new Date().toISOString() }];
  changed();
  forgetFollow(userId);
  await save();
  tellServer(userId, true);
}

export async function unblockUser(userId: string) {
  await loadBlocks();
  blockedUsers = blockedUsers.filter((u) => u.id !== userId);
  changed();
  await save();
  tellServer(userId, false);
}

export async function hidePost(postId: string) {
  await loadBlocks();
  hiddenPosts = new Set(hiddenPosts).add(postId);
  changed();
  await save();
}

export function hiddenPostCount() {
  return hiddenPosts.size;
}

export async function unhideAllPosts() {
  await loadBlocks();
  hiddenPosts = new Set();
  changed();
  await save();
}

// Asks first, then blocks. onDone runs after blocking (e.g. to leave a profile page).
export function confirmBlockUser(userId: string, name: string, onDone?: () => void) {
  Alert.alert(
    `Block ${name}?`,
    "You won't see their jokes, memes or videos any more, and any follow between you is removed. They won't be told. You can unblock them in Settings.\n\nIf they broke the rules, please also report the post.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Block",
        style: "destructive",
        onPress: async () => {
          await blockUser(userId, name);
          onDone?.();
        },
      },
    ]
  );
}

// "⋯" menu on a post: block the person, or hide just this post (anonymous posts).
export function showPostMenu(post: { id: string; userId: string | null; name: string | null }) {
  const named = !!post.userId && !!post.name && post.name !== "Anonymous";
  const buttons: { text: string; style?: "cancel" | "destructive"; onPress?: () => void }[] = [];
  if (named) {
    buttons.push({
      text: `Block ${post.name}`,
      style: "destructive",
      onPress: () => confirmBlockUser(post.userId as string, post.name as string),
    });
  }
  buttons.push({ text: "Hide this post", onPress: () => hidePost(post.id) });
  buttons.push({ text: "Cancel", style: "cancel" });
  Alert.alert("Options", undefined, buttons);
}

// Re-renders the calling screen when blocks change; the returned number changes each time,
// so screens can use it to recalculate their lists.
export function useBlocks(): number {
  const [v, setV] = useState(version);
  useEffect(() => {
    loadBlocks();
    const sub = DeviceEventEmitter.addListener(BLOCKS_CHANGED_EVENT, (n: number) => setV(n));
    setV(version);
    return () => sub.remove();
  }, []);
  return v;
}
