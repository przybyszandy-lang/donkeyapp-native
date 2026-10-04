// Shared joke actions used by Reel mode: favourite, vote, report, share.
//
// They use exactly the same phone storage keys and Supabase functions as the
// Home, Favourites and Profile screens, so a video is the same joke ID
// everywhere. After a change they broadcast an event so open screens refresh.

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { DeviceEventEmitter, Share } from "react-native";

import { supabase } from "./supabase";

export const FAVOURITES_KEY = "donkey:favourites:v1";
export const VOTES_KEY = "donkey:votes:v1";
export const FAVOURITES_CHANGED_EVENT = "favouritesChanged";
export const VOTES_CHANGED_EVENT = "votesChanged";

export type Vote = "bad" | "meh" | "good" | "great";

export async function loadFavouriteIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch (e) {
    console.log("Failed to load favourites:", e);
    return [];
  }
}

export async function toggleFavourite(jokeId: string): Promise<string[]> {
  const current = await loadFavouriteIds();
  const next = current.includes(jokeId)
    ? current.filter((id) => id !== jokeId)
    : [...current, jokeId];

  try {
    await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(next));
  } catch (e) {
    console.log("Failed to save favourites:", e);
  }

  DeviceEventEmitter.emit(FAVOURITES_CHANGED_EVENT, next);
  return next;
}

export async function loadVotes(): Promise<Record<string, Vote>> {
  try {
    const raw = await AsyncStorage.getItem(VOTES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Vote>) : {};
  } catch (e) {
    console.log("Failed to load votes:", e);
    return {};
  }
}

// Returns true if the vote reached Supabase.
export async function castVote(jokeId: string, vote: Vote): Promise<boolean> {
  const current = await loadVotes();
  if (current[jokeId]) return true;

  const next = { ...current, [jokeId]: vote };

  try {
    await AsyncStorage.setItem(VOTES_KEY, JSON.stringify(next));
  } catch (e) {
    console.log("Failed to save vote:", e);
  }

  DeviceEventEmitter.emit(VOTES_CHANGED_EVENT, next);

  const { error } = await supabase.rpc("rate_joke", { p_id: jokeId, p_vote: vote });
  if (error) {
    console.log("Supabase vote failed:", error);
    return false;
  }
  return true;
}

export async function reportJoke(jokeId: string, reason: string): Promise<boolean> {
  const { error } = await supabase.rpc("report_joke", {
    p_joke_id: jokeId,
    p_reason: reason,
  });
  if (error) {
    console.log("Report failed:", error);
    return false;
  }
  return true;
}

export async function shareVideo(jokeId: string): Promise<void> {
  const shareText =
    "Check out this video on Donkey App 😂" +
    `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

  try {
    await Share.share({ message: shareText });
  } catch {
    await Clipboard.setStringAsync(shareText);
  }
}

export function voteEmoji(vote?: Vote | null): string | null {
  if (vote === "bad") return "😕";
  if (vote === "meh") return "😐";
  if (vote === "good") return "🙂";
  if (vote === "great") return "😂";
  return null;
}
