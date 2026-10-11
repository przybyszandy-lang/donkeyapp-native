// Top of a public profile: picture, name, joined date, about me (first ~100 characters + "more"),
// website, counts and the All / Jokes / Memes / Videos switch.
import { MaterialIcons } from "@expo/vector-icons";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { BIO_PREVIEW, displayWebsite, PublicProfile } from "../../lib/profile";
import { palette, Segmented } from "../creator/ui";
import Avatar from "./Avatar";

export type ProfileTypeFilter = "all" | "joke" | "meme" | "video";

function shortBio(text: string): { short: string; cut: boolean } {
  if (text.length <= BIO_PREVIEW + 20) return { short: text, cut: false };
  const slice = text.slice(0, BIO_PREVIEW);
  const lastSpace = slice.lastIndexOf(" ");
  return { short: (lastSpace > 60 ? slice.slice(0, lastSpace) : slice).trimEnd() + "…", cut: true };
}

function joinedText(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `Joined ${d.toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`;
}

function Stat({ value, label, darkMode }: { value: number; label: string; darkMode: boolean }) {
  const p = palette(darkMode);
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color: p.text }]}>{value.toLocaleString("en-GB")}</Text>
      <Text style={[styles.statLabel, { color: p.muted }]}>{label}</Text>
    </View>
  );
}

export default function ProfileHeader({
  userId,
  profile,
  fallbackName,
  darkMode,
  textScale,
  filter,
  onFilterChange,
}: {
  userId: string;
  profile: PublicProfile | null;
  fallbackName: string;
  darkMode: boolean;
  textScale: number;
  filter: ProfileTypeFilter;
  onFilterChange: (f: ProfileTypeFilter) => void;
}) {
  const p = palette(darkMode);
  const [expanded, setExpanded] = useState(false);

  const name = profile?.display_name?.trim() || fallbackName;
  const bio = profile?.bio?.trim() ?? "";
  const { short, cut } = shortBio(bio);
  const joined = joinedText(profile?.joined_at ?? null);

  const counts = {
    joke: profile?.joke_count ?? 0,
    meme: profile?.meme_count ?? 0,
    video: profile?.video_count ?? 0,
  };

  const options: { value: ProfileTypeFilter; label: string }[] = [{ value: "all", label: "All" }];
  if (counts.joke > 0) options.push({ value: "joke", label: "Jokes" });
  if (counts.meme > 0) options.push({ value: "meme", label: "Memes" });
  if (counts.video > 0) options.push({ value: "video", label: "Videos" });

  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <View style={styles.topRow}>
        <Avatar userId={userId} updatedAt={profile?.avatar_updated_at} name={name} size={80} />
        <View style={styles.nameBox}>
          <Text style={[styles.name, { color: p.text, fontSize: 22 * textScale }]} numberOfLines={2}>
            {name}
          </Text>
          {joined ? (
            <Text style={[styles.joined, { color: p.muted, fontSize: 13 * textScale }]}>{joined}</Text>
          ) : null}
        </View>
      </View>

      {bio ? (
        <Text style={[styles.bio, { color: p.text, fontSize: 15 * textScale, lineHeight: 21 * textScale }]}>
          {expanded || !cut ? bio : short}
          {cut ? (
            <Text style={[styles.more, { color: p.accent }]} onPress={() => setExpanded((v) => !v)}>
              {expanded ? "  less" : "  more"}
            </Text>
          ) : null}
        </Text>
      ) : null}

      {profile?.website ? (
        <Pressable
          style={styles.websiteRow}
          onPress={() => Linking.openURL(profile.website as string).catch(() => null)}
          hitSlop={6}
        >
          <MaterialIcons name="link" size={18} color={p.accent} />
          <Text style={[styles.website, { color: p.accent, fontSize: 14 * textScale }]} numberOfLines={1}>
            {displayWebsite(profile.website)}
          </Text>
        </Pressable>
      ) : null}

      <View style={[styles.statsRow, { borderColor: p.border }]}>
        <Stat value={counts.joke} label="Jokes" darkMode={darkMode} />
        <Stat value={counts.meme} label="Memes" darkMode={darkMode} />
        <Stat value={counts.video} label="Videos" darkMode={darkMode} />
        <Stat value={profile?.votes_received ?? 0} label="Votes" darkMode={darkMode} />
      </View>

      {options.length > 2 ? (
        <View style={styles.filterBox}>
          <Segmented darkMode={darkMode} value={filter} onChange={onFilterChange} options={options} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  nameBox: {
    flex: 1,
  },
  name: {
    fontFamily: "OpenSans_600SemiBold",
  },
  joined: {
    marginTop: 2,
    fontFamily: "OpenSans_400Regular",
  },
  bio: {
    marginTop: 14,
    fontFamily: "OpenSans_400Regular",
  },
  more: {
    fontFamily: "OpenSans_600SemiBold",
  },
  websiteRow: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  website: {
    fontFamily: "OpenSans_600SemiBold",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  filterBox: {
    marginTop: 14,
  },
  stat: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontFamily: "OpenSans_600SemiBold",
  },
  statLabel: {
    fontSize: 12,
    fontFamily: "OpenSans_400Regular",
    marginTop: 1,
  },
});
