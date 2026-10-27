// Settings → Blocked users: people you blocked (unblock them here) and posts you hid.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  getBlockedUsers,
  hiddenPostCount,
  unblockUser,
  unhideAllPosts,
  useBlocks,
} from "../lib/blocks";

export default function BlockedUsersScreen() {
  const [darkMode, setDarkMode] = useState(false);
  const [textScale, setTextScale] = useState(1);
  const blocksVersion = useBlocks();
  const users = getBlockedUsers(blocksVersion);
  const hidden = hiddenPostCount(blocksVersion);

  useEffect(() => {
    (async () => {
      try {
        const [rawDark, rawText] = await Promise.all([
          AsyncStorage.getItem("donkey:darkmode:v1"),
          AsyncStorage.getItem("donkey:textsize:v1"),
        ]);
        setDarkMode(rawDark === "true");
        setTextScale(rawText === "Small" ? 0.9 : rawText === "Large" ? 1.2 : 1);
      } catch {
        // keep defaults
      }
    })();
  }, []);

  const t = (size: number) => ({ fontSize: size * textScale });
  const text = darkMode ? "#f3f3f3" : "#111";
  const muted = darkMode ? "#bdbdbd" : "#666";
  const box = [styles.box, darkMode && styles.boxDark];

  return (
    <ScrollView
      style={[styles.screen, darkMode && styles.screenDark]}
      contentContainerStyle={styles.content}
    >
      <Pressable style={[styles.backButton, darkMode && styles.boxDark]} onPress={() => router.back()}>
        <Text style={[styles.backButtonText, t(15), { color: text }]}>← Back</Text>
      </Pressable>

      <Text style={[styles.title, t(22), { color: text }]}>Blocked users</Text>
      <Text style={[styles.note, t(14), { color: muted }]}>
        {"You don't see posts from people you block. They are not told. Blocking only affects this phone."}
      </Text>

      <View style={box}>
        {users.length === 0 ? (
          <Text style={[styles.empty, t(15), { color: muted }]}>{"You haven't blocked anyone."}</Text>
        ) : (
          users.map((u, i) => (
            <View
              key={u.id}
              style={[styles.row, i > 0 && styles.rowBorder, darkMode && i > 0 && styles.rowBorderDark]}
            >
              <Text style={[styles.name, t(16), { color: text }]} numberOfLines={1}>
                {u.name}
              </Text>
              <Pressable
                style={styles.unblock}
                onPress={() =>
                  Alert.alert(`Unblock ${u.name}?`, "You will see their posts again.", [
                    { text: "Cancel", style: "cancel" },
                    { text: "Unblock", onPress: () => unblockUser(u.id) },
                  ])
                }
              >
                <Text style={[styles.unblockText, t(14)]}>Unblock</Text>
              </Pressable>
            </View>
          ))
        )}
      </View>

      <Text style={[styles.subtitle, t(17), { color: text }]}>Hidden posts</Text>
      <View style={box}>
        <View style={styles.row}>
          <Text style={[styles.name, t(15), { color: text }]}>
            {hidden === 0 ? "No hidden posts" : hidden === 1 ? "1 hidden post" : `${hidden} hidden posts`}
          </Text>
          {hidden > 0 ? (
            <Pressable style={styles.unblock} onPress={() => unhideAllPosts()}>
              <Text style={[styles.unblockText, t(14)]}>Show again</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#efefef" },
  screenDark: { backgroundColor: "#101010" },
  content: { padding: 16, paddingBottom: 40 },
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 14,
  },
  backButtonText: { fontWeight: "600" },
  title: { fontWeight: "700", marginBottom: 6 },
  subtitle: { fontWeight: "700", marginTop: 18, marginBottom: 8 },
  note: { lineHeight: 20, marginBottom: 14 },
  box: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 14,
  },
  boxDark: { backgroundColor: "#1b1b1b", borderColor: "#333" },
  empty: { paddingVertical: 16 },
  row: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10 },
  rowBorder: { borderTopWidth: 1, borderTopColor: "#eee" },
  rowBorderDark: { borderTopColor: "#333" },
  name: { flex: 1, fontWeight: "600" },
  unblock: {
    borderWidth: 1,
    borderColor: "#1877f2",
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  unblockText: { color: "#1877f2", fontWeight: "700" },
});
