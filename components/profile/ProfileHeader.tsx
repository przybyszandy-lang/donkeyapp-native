// Top of a public profile: picture, name, joined date, about me (first ~100 characters + "more"),
// website, counts and the All / Jokes / Memes / Videos switch.
import { FontAwesome6, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useState } from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { isFollowing, useFollows } from "../../lib/follows";
import {
  BIO_PREVIEW,
  CreatorEvent,
  displayWebsite,
  eventDateText,
  PublicProfile,
  SOCIALS,
} from "../../lib/profile";
import { palette, Segmented } from "../creator/ui";
import Avatar from "./Avatar";
import { FollowButton } from "./CardAuthor";

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
  events,
}: {
  userId: string;
  profile: PublicProfile | null;
  events: CreatorEvent[];
  fallbackName: string;
  darkMode: boolean;
  textScale: number;
  filter: ProfileTypeFilter;
  onFilterChange: (f: ProfileTypeFilter) => void;
}) {
  const p = palette(darkMode);
  const [expanded, setExpanded] = useState(false);
  const me = useFollows();
  const isMe = !!me && me === userId;

  // Follower count updates straight away when you tap Follow.
  const followers =
    (profile?.followers_count ?? 0) + (isFollowing(userId) ? 1 : 0) - (profile?.i_follow ? 1 : 0);
  const following = profile?.following_count ?? 0;

  const openList = (type: "followers" | "following") => {
    router.push({
      pathname: "/follows",
      params: {
        userId,
        type,
        name: profile?.display_name ?? "",
        isPublic: String(type === "followers" ? profile?.show_followers !== false : profile?.show_following !== false),
      },
    });
  };

  const socials = SOCIALS.filter((s) => !!profile?.[s.key]);

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
          {profile ? (
            <View style={styles.followRow}>
              <Text style={[styles.followCount, { color: p.text, fontSize: 13 * textScale }]} onPress={() => openList("followers")}>
                {followers.toLocaleString("en-GB")} <Text style={{ color: p.muted }}>{followers === 1 ? "follower" : "followers"}</Text>
              </Text>
              <Text style={[styles.followCount, { color: p.text, fontSize: 13 * textScale }]} onPress={() => openList("following")}>
                {following.toLocaleString("en-GB")} <Text style={{ color: p.muted }}>following</Text>
              </Text>
            </View>
          ) : null}
        </View>
      </View>

      {profile && !isMe ? (
        <View style={styles.followButtonBox}>
          <FollowButton userId={userId} darkMode={darkMode} />
        </View>
      ) : null}

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

      {socials.length > 0 ? (
        <View style={styles.socialRow}>
          {socials.map((s) => (
            <Pressable
              key={s.key}
              style={[styles.socialButton, { backgroundColor: p.soft }]}
              onPress={() => Linking.openURL(s.url(profile![s.key] as string)).catch(() => null)}
              accessibilityLabel={`${s.label}: ${profile![s.key]}`}
              hitSlop={4}
            >
              <FontAwesome6 name={s.icon} brand size={18} color={p.text} />
            </Pressable>
          ))}
        </View>
      ) : null}

      {events.length > 0 ? (
        <View style={[styles.events, { borderColor: p.border }]}>
          <Text style={[styles.eventsTitle, { color: p.text, fontSize: 15 * textScale }]}>Upcoming events</Text>
          {events.map((e) => (
            <View key={e.id} style={[styles.event, { backgroundColor: p.soft }]}>
              <View style={styles.eventText}>
                <Text style={[styles.eventDate, { color: p.accent, fontSize: 12 * textScale }]}>
                  {eventDateText(e.starts_at)}
                </Text>
                <Text style={[styles.eventTitle, { color: p.text, fontSize: 15 * textScale }]}>{e.title}</Text>
                {e.venue || e.city ? (
                  <Text style={[styles.eventPlace, { color: p.muted, fontSize: 13 * textScale }]}>
                    {[e.venue, e.city].filter(Boolean).join(", ")}
                  </Text>
                ) : null}
              </View>
              {e.ticket_url ? (
                <Pressable
                  style={styles.ticketButton}
                  onPress={() => Linking.openURL(e.ticket_url as string).catch(() => null)}
                  hitSlop={4}
                >
                  <Text style={styles.ticketText}>Tickets</Text>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
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
  followRow: {
    flexDirection: "row",
    gap: 14,
    marginTop: 4,
  },
  followCount: {
    fontFamily: "OpenSans_600SemiBold",
  },
  followButtonBox: {
    marginTop: 14,
  },
  socialRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  socialButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  events: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  eventsTitle: {
    fontFamily: "OpenSans_600SemiBold",
  },
  event: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  eventText: {
    flex: 1,
  },
  eventDate: {
    fontFamily: "OpenSans_600SemiBold",
  },
  eventTitle: {
    fontFamily: "OpenSans_600SemiBold",
    marginTop: 2,
  },
  eventPlace: {
    fontFamily: "OpenSans_400Regular",
    marginTop: 1,
  },
  ticketButton: {
    backgroundColor: "#1f5fd1",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  ticketText: {
    color: "#fff",
    fontSize: 13,
    fontFamily: "OpenSans_600SemiBold",
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
