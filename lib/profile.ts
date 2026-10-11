// Creator profile helpers: public profile data, profile picture upload/remove, website tidy-up.
// Profile pictures live in the "avatars" bucket, one file per user: <user id>/avatar.jpg.
// Uploading a new picture overwrites the old file; ?v=<avatar_updated_at> makes phones show the new one.

import { decode } from "base64-arraybuffer";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

import { supabase } from "./supabase";

const AVATARS_BASE =
  "https://mknsvxajrvdlwqywvlrf.supabase.co/storage/v1/object/public/avatars/";

export const BIO_MAX = 1000;
export const BIO_PREVIEW = 100;
export const WEBSITE_MAX = 200;

export type PublicProfile = {
  id: string;
  display_name: string | null;
  bio: string | null;
  website: string | null;
  avatar_updated_at: string | null;
  joined_at: string | null;
  joke_count: number;
  meme_count: number;
  video_count: number;
  votes_received: number;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  x_handle: string | null;
  facebook: string | null;
  followers_count: number;
  following_count: number;
  show_followers: boolean;
  show_following: boolean;
  i_follow: boolean;
};

export type SocialKey = "instagram" | "tiktok" | "youtube" | "x_handle" | "facebook";

export const SOCIALS: {
  key: SocialKey;
  label: string;
  icon: string;
  pattern: RegExp;
  url: (handle: string) => string;
  hosts: string[];
}[] = [
  { key: "instagram", label: "Instagram", icon: "instagram", pattern: /^[A-Za-z0-9._]{1,30}$/, url: (h) => `https://www.instagram.com/${h}`, hosts: ["instagram.com"] },
  { key: "tiktok", label: "TikTok", icon: "tiktok", pattern: /^[A-Za-z0-9._]{1,30}$/, url: (h) => `https://www.tiktok.com/@${h}`, hosts: ["tiktok.com"] },
  { key: "youtube", label: "YouTube", icon: "youtube", pattern: /^[A-Za-z0-9._-]{1,60}$/, url: (h) => `https://www.youtube.com/@${h}`, hosts: ["youtube.com"] },
  { key: "x_handle", label: "X", icon: "x-twitter", pattern: /^[A-Za-z0-9_]{1,15}$/, url: (h) => `https://x.com/${h}`, hosts: ["x.com", "twitter.com"] },
  { key: "facebook", label: "Facebook", icon: "facebook", pattern: /^[A-Za-z0-9.]{1,60}$/, url: (h) => `https://www.facebook.com/${h}`, hosts: ["facebook.com", "fb.com"] },
];

export type MyProfile = {
  display_name: string;
  bio: string;
  website: string;
  avatar_updated_at: string | null;
  instagram: string;
  tiktok: string;
  youtube: string;
  x_handle: string;
  facebook: string;
  show_followers: boolean;
  show_following: boolean;
};

// Accepts "name", "@name" or a full profile link and returns just the username.
export function tidyHandle(key: SocialKey, raw: string): { value: string | null; error: string | null } {
  const social = SOCIALS.find((x) => x.key === key)!;
  let text = raw.trim();
  if (!text) return { value: null, error: null };
  if (/^(https?:\/\/)?(www\.|m\.)?[a-z.]+\.[a-z]+\//i.test(text)) {
    const host = text.replace(/^https?:\/\//i, "").replace(/^(www\.|m\.)/i, "").split("/")[0].toLowerCase();
    if (!social.hosts.includes(host)) {
      return { value: null, error: `That doesn't look like a ${social.label} link.` };
    }
    const parts = text.replace(/^https?:\/\//i, "").split(/[?#]/)[0].split("/").filter(Boolean);
    const skip = ["channel", "c", "user", "profile.php"];
    text = (skip.includes(parts[1] ?? "") ? parts[2] : parts[1]) ?? "";
  }
  text = text.replace(/^@/, "");
  if (!social.pattern.test(text)) {
    return { value: null, error: `Please enter a valid ${social.label} username.` };
  }
  return { value: text, error: null };
}

export function avatarUrl(userId: string | null | undefined, updatedAt: string | null | undefined): string | null {
  if (!userId || !updatedAt) return null;
  const version = new Date(updatedAt).getTime() || 0;
  return `${AVATARS_BASE}${userId}/avatar.jpg?v=${version}`;
}

export async function fetchPublicProfile(userId: string): Promise<PublicProfile | null> {
  const { data, error } = await supabase.rpc("get_public_profile", { p_user_id: userId });
  if (error) throw error;
  const row = (data ?? [])[0];
  if (!row) return null;
  return {
    ...row,
    joke_count: Number(row.joke_count ?? 0),
    meme_count: Number(row.meme_count ?? 0),
    video_count: Number(row.video_count ?? 0),
    votes_received: Number(row.votes_received ?? 0),
    followers_count: Number(row.followers_count ?? 0),
    following_count: Number(row.following_count ?? 0),
    show_followers: row.show_followers !== false,
    show_following: row.show_following !== false,
    i_follow: !!row.i_follow,
  } as PublicProfile;
}

export async function fetchMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "display_name, bio, website, avatar_updated_at, instagram, tiktok, youtube, x_handle, facebook, show_followers, show_following"
    )
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    display_name: data?.display_name ?? "",
    bio: data?.bio ?? "",
    website: data?.website ?? "",
    avatar_updated_at: data?.avatar_updated_at ?? null,
    instagram: data?.instagram ?? "",
    tiktok: data?.tiktok ?? "",
    youtube: data?.youtube ?? "",
    x_handle: data?.x_handle ?? "",
    facebook: data?.facebook ?? "",
    show_followers: data?.show_followers !== false,
    show_following: data?.show_following !== false,
  };
}

// Returns null if fine, otherwise a message for the user.
// Adds https:// when the person typed e.g. "mysite.com".
export function tidyWebsite(raw: string): { value: string | null; error: string | null } {
  const trimmed = raw.trim();
  if (!trimmed) return { value: null, error: null };
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  if (withScheme.length > WEBSITE_MAX) return { value: null, error: "Website link is too long." };
  if (/\s/.test(withScheme) || !/^https?:\/\/[^/\s.?#][^\s]*\.[^\s]+/i.test(withScheme)) {
    return { value: null, error: "Please enter a valid website, e.g. mysite.com" };
  }
  return { value: withScheme, error: null };
}

export function displayWebsite(url: string): string {
  return url.replace(/^https?:\/\//i, "").replace(/\/$/, "");
}

// Lets the person take or pick a photo, crops it square, shrinks it, uploads it (overwriting the old one).
// Returns the new avatar_updated_at, or null if they cancelled.
export async function pickAndUploadAvatar(
  userId: string,
  source: "camera" | "library" = "library"
): Promise<string | null> {
  const permission =
    source === "camera"
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error(
      source === "camera"
        ? "Please allow camera access in your phone settings to take a profile picture."
        : "Please allow access to your photos in your phone settings to choose a profile picture."
    );
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  };
  const picked =
    source === "camera"
      ? await ImagePicker.launchCameraAsync({ ...options, cameraType: ImagePicker.CameraType.front })
      : await ImagePicker.launchImageLibraryAsync(options);
  if (picked.canceled || !picked.assets?.[0]?.uri) return null;

  const context = ImageManipulator.manipulate(picked.assets[0].uri);
  context.resize({ width: 512, height: 512 });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ format: SaveFormat.JPEG, compress: 0.8, base64: true });
  if (!saved.base64) throw new Error("Could not prepare the picture.");

  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(`${userId}/avatar.jpg`, decode(saved.base64), {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "60",
    });
  if (uploadError) throw uploadError;

  const updatedAt = new Date().toISOString();
  const { error: saveError } = await supabase
    .from("profiles")
    .update({ avatar_updated_at: updatedAt, updated_at: updatedAt })
    .eq("id", userId);
  if (saveError) throw saveError;

  return updatedAt;
}

export async function removeAvatar(userId: string): Promise<void> {
  const { error: removeError } = await supabase.storage.from("avatars").remove([`${userId}/avatar.jpg`]);
  if (removeError) throw removeError;
  const { error } = await supabase
    .from("profiles")
    .update({ avatar_updated_at: null, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Events (e.g. upcoming shows)
// ---------------------------------------------------------------------------

export type CreatorEvent = {
  id: string;
  title: string;
  venue: string | null;
  city: string | null;
  starts_at: string;
  ticket_url: string | null;
};

export async function fetchUserEvents(userId: string): Promise<CreatorEvent[]> {
  const { data, error } = await supabase.rpc("get_user_events", { p_user_id: userId });
  if (error) throw error;
  return (data ?? []) as CreatorEvent[];
}

export async function fetchMyEvents(): Promise<CreatorEvent[]> {
  const since = new Date(Date.now() - 6 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("creator_events")
    .select("id, title, venue, city, starts_at, ticket_url")
    .gte("starts_at", since)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CreatorEvent[];
}

export async function saveEvent(
  event: Omit<CreatorEvent, "id">,
  id?: string
): Promise<void> {
  const { error } = id
    ? await supabase.from("creator_events").update(event).eq("id", id)
    : await supabase.from("creator_events").insert(event);
  if (error) throw error;
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from("creator_events").delete().eq("id", id);
  if (error) throw error;
}

export function eventDateText(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  return `${date} · ${time}`;
}
