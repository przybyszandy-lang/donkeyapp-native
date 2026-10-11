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
};

export type MyProfile = {
  display_name: string;
  bio: string;
  website: string;
  avatar_updated_at: string | null;
};

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
  } as PublicProfile;
}

export async function fetchMyProfile(userId: string): Promise<MyProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .select("display_name, bio, website, avatar_updated_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return {
    display_name: data?.display_name ?? "",
    bio: data?.bio ?? "",
    website: data?.website ?? "",
    avatar_updated_at: data?.avatar_updated_at ?? null,
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

// Lets the person pick a photo, crops it square, shrinks it, uploads it (overwriting the old one).
// Returns the new avatar_updated_at, or null if they cancelled.
export async function pickAndUploadAvatar(userId: string): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    throw new Error("Please allow access to your photos in your phone settings to choose a profile picture.");
  }

  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: true,
    aspect: [1, 1],
    quality: 1,
  });
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
