// Top row of a feed card: profile picture + name (tap = open profile) + Follow button.
// Anonymous posts show a blank face and no Follow button. Your own posts show no Follow button.
import { router } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { isFollowing, toggleFollow, useCardAvatar, useFollows } from "../../lib/follows";
import Avatar from "./Avatar";

export function FollowButton({
  userId,
  darkMode,
  small = false,
}: {
  userId: string;
  darkMode: boolean;
  small?: boolean;
}) {
  const me = useFollows();
  if (me && me === userId) return null;
  const following = isFollowing(userId);

  return (
    <Pressable
      onPress={() => toggleFollow(userId)}
      hitSlop={6}
      style={[
        styles.follow,
        small && styles.followSmall,
        following
          ? [styles.following, darkMode && { borderColor: "#555" }]
          : styles.notFollowing,
      ]}
      accessibilityRole="button"
      accessibilityLabel={following ? "Unfollow" : "Follow"}
    >
      <Text
        style={[
          styles.followText,
          small && styles.followTextSmall,
          { color: following ? (darkMode ? "#d0d0d0" : "#333") : "#fff" },
        ]}
      >
        {following ? "Following" : "Follow"}
      </Text>
    </Pressable>
  );
}

export default function CardAuthor({
  userId,
  displayName,
  darkMode,
  textScale,
}: {
  userId: string | null;
  displayName: string | null | undefined;
  darkMode: boolean;
  textScale: number;
}) {
  const avatarUpdatedAt = useCardAvatar(userId);
  const named = !!userId && !!displayName && displayName !== "Anonymous";
  const name = named ? (displayName as string) : "Anonymous";

  const openProfile = () => {
    if (!named) return;
    router.push({ pathname: "/profile/[userId]", params: { userId: userId as string } });
  };

  return (
    <View style={styles.row}>
      <Pressable style={styles.who} onPress={openProfile} disabled={!named} hitSlop={4}>
        <Avatar userId={named ? userId : null} updatedAt={avatarUpdatedAt ?? null} name={name} size={36} />
        <Text
          numberOfLines={1}
          style={[
            styles.name,
            { fontSize: 15 * textScale },
            { color: darkMode ? "#f3f3f3" : "#111" },
          ]}
        >
          {name}
        </Text>
      </Pressable>
      {named ? <FollowButton userId={userId as string} darkMode={darkMode} small /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    gap: 10,
  },
  who: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  name: {
    flexShrink: 1,
    fontFamily: "OpenSans_600SemiBold",
  },
  follow: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },
  followSmall: {
    paddingVertical: 5,
    paddingHorizontal: 14,
  },
  notFollowing: {
    backgroundColor: "#1f5fd1",
    borderColor: "#1f5fd1",
  },
  following: {
    backgroundColor: "transparent",
    borderColor: "#c8c8c8",
  },
  followText: {
    fontSize: 15,
    fontFamily: "OpenSans_600SemiBold",
  },
  followTextSmall: {
    fontSize: 13,
  },
});
