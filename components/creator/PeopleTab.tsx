// My Profile → People: follower stats + who follows me / who I follow.
// The owner always sees both lists; the privacy switches in the Profile tab only
// decide what other people can see on the public profile.
import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, DeviceEventEmitter, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import StatsBarChart from "../StatsBarChart";
import Avatar from "../profile/Avatar";
import { FollowButton } from "../profile/CardAuthor";
import { FOLLOWS_CHANGED_EVENT } from "../../lib/follows";
import {
  addDays,
  DayRow,
  EMPTY_TOTALS,
  fmtNum,
  groupDays,
  Grouping,
  Period,
  periodStart,
  todayIso,
} from "../../lib/creatorStats";
import { supabase } from "../../lib/supabase";
import { Card, palette, SectionTitle, Segmented, Tile } from "./ui";

type Stats = { followers: number; following: number; days: { day: string; n: number }[] };
type Person = { id: string; display_name: string | null; avatar_updated_at: string | null; followed_at: string };
type ListType = "followers" | "following";

const PAGE = 50;
const FOLLOWER_COLOR = "#ec4899";

function sinceText(iso: string): string {
  const d = new Date(iso);
  return "since " + d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

export default function PeopleTab({ userId, darkMode }: { userId: string; darkMode: boolean }) {
  const p = palette(darkMode);
  const [stats, setStats] = useState<Stats | null>(null);
  const [period, setPeriod] = useState<Period>("30");
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [listType, setListType] = useState<ListType>("followers");
  const [people, setPeople] = useState<Person[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingList, setLoadingList] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    const { data, error: e } = await supabase.rpc("get_my_follow_stats");
    if (e) throw e;
    setStats((data ?? { followers: 0, following: 0, days: [] }) as Stats);
  }, []);

  const loadList = useCallback(
    async (offset: number) => {
      const { data, error: e } = await supabase.rpc(
        listType === "followers" ? "get_followers" : "get_following",
        { p_user_id: userId, p_limit: PAGE, p_offset: offset }
      );
      if (e) throw e;
      const next = (data ?? []) as Person[];
      setPeople((prev) => (offset === 0 ? next : [...prev, ...next]));
      setHasMore(next.length === PAGE);
    },
    [listType, userId]
  );

  const refresh = useCallback(() => {
    setError(null);
    loadStats()
      .catch((e) => setError(e?.message ?? "Could not load your followers."))
      .finally(() => setLoadingStats(false));
    loadList(0)
      .catch((e) => setError(e?.message ?? "Could not load your followers."))
      .finally(() => setLoadingList(false));
  }, [loadStats, loadList]);

  useEffect(() => {
    setLoadingList(true);
    refresh();
  }, [refresh]);

  // Follow / unfollow anywhere in the app → update the numbers and lists here.
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener(FOLLOWS_CHANGED_EVENT, () => refresh());
    return () => sub.remove();
  }, [refresh]);

  useEffect(() => {
    setGrouping(period === "all" ? "week" : "day");
  }, [period]);

  const to = todayIso();
  const from = periodStart(period);

  const days: DayRow[] = useMemo(
    () => (stats?.days ?? []).map((d) => ({ day: d.day, ...EMPTY_TOTALS, points: Number(d.n) || 0 })),
    [stats]
  );
  const buckets = useMemo(() => groupDays(days, from, to, grouping), [days, from, to, grouping]);
  const newInPeriod = days.filter((d) => d.day >= from && d.day <= to).reduce((a, d) => a + d.points, 0);
  const weekFrom = addDays(to, -6);
  const newIn7 = days.filter((d) => d.day >= weekFrom).reduce((a, d) => a + d.points, 0);

  const periodName = period === "all" ? "all time" : `last ${period} days`;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {error ? (
        <Card darkMode={darkMode}>
          <Text style={{ color: "#c62828", fontFamily: "OpenSans_500Medium" }}>{error}</Text>
          <Pressable onPress={refresh}>
            <Text style={[styles.link, { color: p.accent }]}>Retry</Text>
          </Pressable>
        </Card>
      ) : null}

      {loadingStats ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile
              darkMode={darkMode}
              label="Followers"
              color={FOLLOWER_COLOR}
              value={fmtNum(stats?.followers ?? 0)}
              sub="people who follow you"
            />
            <Tile
              darkMode={darkMode}
              label="New this week"
              color="#10b981"
              value={(newIn7 > 0 ? "+" : "") + fmtNum(newIn7)}
              sub="last 7 days"
            />
            <Tile
              darkMode={darkMode}
              label="Following"
              color="#3b82f6"
              value={fmtNum(stats?.following ?? 0)}
              sub="people you follow"
            />
            <Tile
              darkMode={darkMode}
              label="New followers"
              color="#8b5cf6"
              value={(newInPeriod > 0 ? "+" : "") + fmtNum(newInPeriod)}
              sub={periodName}
            />
          </View>

          <Card darkMode={darkMode}>
            <SectionTitle darkMode={darkMode} title="New followers" sub="Tap a bar to see its number" />
            <View style={{ marginBottom: 12 }}>
              <Segmented
                darkMode={darkMode}
                value={period}
                onChange={setPeriod}
                options={[
                  { value: "7", label: "7 days" },
                  { value: "30", label: "30 days" },
                  { value: "90", label: "90 days" },
                  { value: "all", label: "All time" },
                ]}
              />
            </View>
            <StatsBarChart buckets={buckets} metric="points" color={FOLLOWER_COLOR} darkMode={darkMode} />
            <View style={{ marginTop: 12 }}>
              <Segmented
                darkMode={darkMode}
                value={grouping}
                onChange={setGrouping}
                options={[
                  { value: "day", label: "Day" },
                  { value: "week", label: "Week" },
                  { value: "month", label: "Month" },
                  { value: "year", label: "Year" },
                ]}
              />
            </View>
            <Text style={[styles.note, { color: p.muted }]}>
              Counts people who still follow you, on the day they started.
            </Text>
          </Card>
        </>
      )}

      <Card darkMode={darkMode}>
        <View style={{ marginBottom: 12 }}>
          <Segmented
            darkMode={darkMode}
            value={listType}
            onChange={setListType}
            options={[
              { value: "followers", label: `Followers (${fmtNum(stats?.followers ?? 0)})` },
              { value: "following", label: `Following (${fmtNum(stats?.following ?? 0)})` },
            ]}
          />
        </View>

        {loadingList ? (
          <ActivityIndicator style={{ marginVertical: 16 }} />
        ) : people.length === 0 ? (
          <Text style={[styles.note, { color: p.muted }]}>
            {listType === "followers" ? "No followers yet." : "You are not following anyone yet."}
          </Text>
        ) : (
          <View style={{ gap: 8 }}>
            {people.map((person) => (
              <View key={person.id} style={[styles.row, { borderColor: p.border }]}>
                <Pressable
                  style={styles.who}
                  onPress={() => router.push({ pathname: "/profile/[userId]", params: { userId: person.id } })}
                >
                  <Avatar userId={person.id} updatedAt={person.avatar_updated_at} name={person.display_name} size={40} />
                  <View style={{ flexShrink: 1 }}>
                    <Text numberOfLines={1} style={[styles.name, { color: p.text }]}>
                      {person.display_name ?? "User"}
                    </Text>
                    <Text numberOfLines={1} style={[styles.since, { color: p.muted }]}>
                      {sinceText(person.followed_at)}
                    </Text>
                  </View>
                </Pressable>
                <FollowButton userId={person.id} darkMode={darkMode} small />
              </View>
            ))}
            {hasMore ? (
              <Pressable onPress={() => loadList(people.length).catch(() => null)} style={styles.more}>
                <Text style={[styles.link, { color: p.accent }]}>Show more</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        <Text style={[styles.note, { color: p.muted }]}>
          You always see both lists. Whether other people can see them is set in the Profile tab.
        </Text>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40, gap: 12 },
  loadingBox: { paddingVertical: 40, alignItems: "center" },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  note: { marginTop: 10, fontSize: 13, lineHeight: 18, fontFamily: "OpenSans_400Regular" },
  link: { marginTop: 8, fontSize: 15, fontFamily: "OpenSans_600SemiBold" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    gap: 10,
  },
  who: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12 },
  name: { fontSize: 15, fontFamily: "OpenSans_600SemiBold" },
  since: { fontSize: 12, fontFamily: "OpenSans_400Regular", marginTop: 2 },
  more: { alignSelf: "center", paddingVertical: 6 },
});
