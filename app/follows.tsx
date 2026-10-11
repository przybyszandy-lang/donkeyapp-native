// Followers / Following list of one user. Respects the user's privacy switches
// (the owner always sees their own lists).
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";

import Avatar from "../components/profile/Avatar";
import { FollowButton } from "../components/profile/CardAuthor";
import { palette } from "../components/creator/ui";
import { getMyUserId, useFollows } from "../lib/follows";
import { supabase } from "../lib/supabase";

type Row = { id: string; display_name: string | null; avatar_updated_at: string | null };
const PAGE = 50;

export default function FollowsScreen() {
  const params = useLocalSearchParams();
  const userId = typeof params.userId === "string" ? params.userId : "";
  const type = params.type === "following" ? "following" : "followers";
  const ownerName = typeof params.name === "string" ? params.name : "";
  const isPublic = params.isPublic !== "false";

  const me = useFollows();
  const [darkMode, setDarkMode] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const p = palette(darkMode);

  const isOwner = !!me && me === userId;
  const hidden = !isPublic && !isOwner;

  useEffect(() => {
    AsyncStorage.getItem("donkey:darkmode:v1")
      .then((v) => setDarkMode(v === "true"))
      .catch(() => null);
  }, []);

  const load = useCallback(
    async (offset: number) => {
      const { data, error } = await supabase.rpc(type === "followers" ? "get_followers" : "get_following", {
        p_user_id: userId,
        p_limit: PAGE,
        p_offset: offset,
      });
      if (error) throw error;
      const next = (data ?? []) as Row[];
      setRows((prev) => (offset === 0 ? next : [...prev, ...next]));
      setHasMore(next.length === PAGE);
    },
    [type, userId]
  );

  useEffect(() => {
    if (!userId || hidden) {
      setLoading(false);
      return;
    }
    setLoading(true);
    load(0)
      .catch((e) => console.log("Failed to load follow list:", e))
      .finally(() => setLoading(false));
  }, [userId, hidden, load, me]);

  const title = type === "followers" ? "Followers" : "Following";

  return (
    <View style={[styles.screen, { backgroundColor: darkMode ? "#101010" : "#efefef" }]}>
      <Pressable
        style={[styles.back, { backgroundColor: p.card, borderColor: p.border }]}
        onPress={() => router.back()}
      >
        <Text style={[styles.backText, { color: p.text }]}>← Back</Text>
      </Pressable>

      <Text style={[styles.title, { color: p.text }]}>
        {title}
        {ownerName ? <Text style={{ color: p.muted }}>{`  ·  ${ownerName}`}</Text> : null}
      </Text>

      {hidden ? (
        <Text style={[styles.note, { color: p.muted }]}>This list is private.</Text>
      ) : loading ? (
        <ActivityIndicator style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(r) => r.id}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && rows.length > 0) load(rows.length).catch(() => null);
          }}
          ListEmptyComponent={
            <Text style={[styles.note, { color: p.muted }]}>
              {type === "followers" ? "No followers yet." : "Not following anyone yet."}
            </Text>
          }
          renderItem={({ item }) => (
            <View style={[styles.row, { backgroundColor: p.card, borderColor: p.border }]}>
              <Pressable
                style={styles.who}
                onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: item.id } })}
              >
                <Avatar userId={item.id} updatedAt={item.avatar_updated_at} name={item.display_name} size={44} />
                <Text numberOfLines={1} style={[styles.name, { color: p.text }]}>
                  {item.display_name ?? "User"}
                </Text>
              </Pressable>
              {getMyUserId() !== item.id ? <FollowButton userId={item.id} darkMode={darkMode} small /> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingTop: 12 },
  back: {
    alignSelf: "flex-start",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  backText: { fontSize: 15, fontFamily: "OpenSans_600SemiBold" },
  title: {
    fontSize: 22,
    fontFamily: "OpenSans_600SemiBold",
    marginHorizontal: 16,
    marginBottom: 12,
  },
  note: {
    marginHorizontal: 16,
    marginTop: 20,
    fontSize: 15,
    fontFamily: "OpenSans_400Regular",
  },
  list: { paddingHorizontal: 16, paddingBottom: 30, gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  name: { flexShrink: 1, fontSize: 16, fontFamily: "OpenSans_600SemiBold" },
});
