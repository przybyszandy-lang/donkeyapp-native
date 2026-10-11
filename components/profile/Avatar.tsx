// Round profile picture. Falls back to the first letter of the name when there is no picture.
import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { avatarUrl } from "../../lib/profile";

const COLORS = ["#1f5fd1", "#7b3fd1", "#c2410c", "#0f766e", "#b91c1c", "#a16207", "#be185d", "#4d7c0f"];

function colorFor(seed: string): string {
  let total = 0;
  for (let i = 0; i < seed.length; i += 1) total = (total + seed.charCodeAt(i)) % 997;
  return COLORS[total % COLORS.length];
}

export default function Avatar({
  userId,
  updatedAt,
  name,
  size = 72,
  localUri,
}: {
  userId: string | null | undefined;
  updatedAt: string | null | undefined;
  name: string | null | undefined;
  size?: number;
  localUri?: string | null;
}) {
  const uri = localUri ?? avatarUrl(userId, updatedAt);

  // Anonymous posts: blank face.
  if (!userId && !uri) {
    return (
      <View style={[{ width: size, height: size, borderRadius: size / 2 }, styles.letterBox, styles.anonymous]}>
        <MaterialIcons name="person" size={size * 0.7} color="#ffffff" />
      </View>
    );
  }
  const letter = (name ?? "").trim().charAt(0).toUpperCase() || "?";
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[box, styles.image]}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        accessibilityLabel={`${name ?? "User"} profile picture`}
      />
    );
  }

  return (
    <View style={[box, styles.letterBox, { backgroundColor: colorFor(userId ?? letter) }]}>
      <Text style={[styles.letter, { fontSize: size * 0.42 }]}>{letter}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    backgroundColor: "#ddd",
  },
  anonymous: {
    backgroundColor: "#b0b4ba",
  },
  letterBox: {
    alignItems: "center",
    justifyContent: "center",
  },
  letter: {
    color: "#fff",
    fontFamily: "OpenSans_600SemiBold",
  },
});
