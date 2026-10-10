// "Dashboard" tab of My Jokes: the creator's own numbers.

import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import {
  addDays,
  averageRating,
  DayRow,
  exampleDaily,
  fmtNum,
  groupDays,
  Grouping,
  ItemStats,
  loadMyDaily,
  loadMyItemStats,
  loadPointsTotal,
  Metric,
  METRICS,
  pct,
  Period,
  periodStart,
  sumRows,
  todayIso,
} from "../../lib/creatorStats";
import { videoFileUrl } from "../../lib/video";
import StatsBarChart from "../StatsBarChart";
import { Card, Chip, MEMES_BASE, MyContentRow, palette, SectionTitle, Segmented, Tile, TypePill } from "./ui";

type Props = {
  items: MyContentRow[];
  darkMode: boolean;
  demo: boolean;
  refreshKey: number;
  onOpenItem: (item: MyContentRow) => void;
};

const CREATOR_SHARE = 0.7;

export default function CreatorDashboard({ items, darkMode, demo, refreshKey, onOpenItem }: Props) {
  const p = palette(darkMode);
  const [period, setPeriod] = useState<Period>("30");
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [metric, setMetric] = useState<Metric>("points");
  const [daily, setDaily] = useState<DayRow[]>([]);
  const [itemStats, setItemStats] = useState<Map<string, ItemStats>>(new Map());
  const [allPoints, setAllPoints] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const to = todayIso();
  // Example data is not limited by the date counting started.
  const from = demo
    ? period === "all"
      ? "2025-10-01"
      : addDays(to, -(Number(period) - 1))
    : periodStart(period);

  // Pick a sensible grouping when the period changes.
  useEffect(() => {
    setGrouping(period === "all" ? "week" : "day");
  }, [period]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        if (demo) {
          const d = exampleDaily("all-content", null, from, to);
          const map = new Map<string, ItemStats>();
          items.forEach((it) => {
            const t = sumRows(exampleDaily(it.id, it.content_type ?? "joke", from, to));
            map.set(it.id, { joke_id: it.id, ...t });
          });
          if (cancelled) return;
          setDaily(d);
          setItemStats(map);
          setAllPoints(Math.round(sumRows(d).points * 7.3));
          return;
        }
        const [d, map, total] = await Promise.all([
          loadMyDaily(null, from, to),
          loadMyItemStats(from, to),
          loadPointsTotal(from, to),
        ]);
        if (cancelled) return;
        setDaily(d);
        setItemStats(map);
        setAllPoints(total);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Could not load your stats.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [from, to, demo, items, refreshKey]);

  // Week grouping makes no sense for 7 days etc. Keep it simple: always allowed.
  const buckets = useMemo(() => groupDays(daily, from, to, grouping), [daily, from, to, grouping]);
  const totals = useMemo(() => sumRows(daily), [daily]);

  const votes = items.reduce(
    (acc, it) => {
      acc.bad += it.rating_bad_count ?? 0;
      acc.meh += it.rating_meh_count ?? 0;
      acc.good += it.rating_good_count ?? 0;
      acc.great += it.rating_great_count ?? 0;
      return acc;
    },
    { bad: 0, meh: 0, good: 0, great: 0 }
  );
  const voteCount = votes.bad + votes.meh + votes.good + votes.great;
  const avg = averageRating(votes.bad, votes.meh, votes.good, votes.great);

  const share = allPoints > 0 ? totals.points / allPoints : 0;

  const top = useMemo(
    () =>
      items
        .map((it) => ({ it, s: itemStats.get(it.id) }))
        .filter((x) => x.s && x.s.points > 0)
        .sort((a, b) => (b.s!.points || 0) - (a.s!.points || 0))
        .slice(0, 5),
    [items, itemStats]
  );

  const counts = {
    joke: items.filter((i) => (i.content_type ?? "joke") === "joke").length,
    meme: items.filter((i) => i.content_type === "meme").length,
    video: items.filter((i) => i.content_type === "video").length,
  };

  const metricInfo = METRICS.find((m) => m.key === metric)!;

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {demo ? (
        <View style={styles.demoBanner}>
          <MaterialIcons name="science" size={16} color="#5b21b6" />
          <Text style={styles.demoText}>Example data — made-up numbers for demonstration.</Text>
        </View>
      ) : null}

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

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator />
        </View>
      ) : error ? (
        <Card darkMode={darkMode}>
          <Text style={{ color: "#c62828", fontFamily: "OpenSans_500Medium" }}>{error}</Text>
        </Card>
      ) : (
        <>
          <View style={styles.tiles}>
            <Tile darkMode={darkMode} label="Points" color="#8b5cf6" value={fmtNum(totals.points)} sub="decide your payout" />
            <Tile darkMode={darkMode} label="Shown" color="#64748b" value={fmtNum(totals.impressions)} sub="times on screen" />
            <Tile
              darkMode={darkMode}
              label="Video views"
              color="#3b82f6"
              value={fmtNum(totals.views_3s)}
              sub={`${pct(totals.views_full, totals.views_3s)} watched to the end`}
            />
            <Tile
              darkMode={darkMode}
              label="Rating"
              color="#f59e0b"
              value={avg ? avg.toFixed(1) + " / 4" : "–"}
              sub={`${fmtNum(voteCount)} votes (all time)`}
            />
          </View>

          <Card darkMode={darkMode}>
            <View style={styles.rowBetween}>
              <SectionTitle darkMode={darkMode} title="Your share" sub="Of all points earned on Donkey App" />
              <Text style={[styles.bigPct, { color: p.text }]}>{(share * 100).toFixed(share < 0.1 ? 2 : 1)}%</Text>
            </View>
            <View style={[styles.track, { backgroundColor: p.soft }]}>
              <View style={[styles.fill, { width: `${Math.min(100, share * 100)}%` }]} />
            </View>
            <Text style={[styles.note, { color: p.muted }]}>
              Creators share {Math.round(CREATOR_SHARE * 100)}% of ad profit, split by points. Your share of that pool in
              this period: {(share * 100).toFixed(2)}%.
            </Text>
          </Card>

          <Card darkMode={darkMode}>
            <SectionTitle darkMode={darkMode} title="Over time" sub="Tap a bar to see its number" />
            <View style={styles.chips}>
              {METRICS.map((m) => (
                <Chip
                  key={m.key}
                  darkMode={darkMode}
                  label={m.label}
                  color={m.color}
                  on={metric === m.key}
                  onPress={() => setMetric(m.key)}
                />
              ))}
            </View>
            <StatsBarChart buckets={buckets} metric={metric} color={metricInfo.color} darkMode={darkMode} />
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
          </Card>

          {totals.views_3s > 0 ? (
            <Card darkMode={darkMode}>
              <SectionTitle darkMode={darkMode} title="How far people watch" sub="Your videos in this period" />
              <Funnel darkMode={darkMode} totals={totals} />
            </Card>
          ) : null}

          <Card darkMode={darkMode}>
            <SectionTitle darkMode={darkMode} title="Top content" sub="Most points in this period" />
            {top.length === 0 ? (
              <Text style={[styles.note, { color: p.muted }]}>
                No views yet in this period. Views are counted from app version 2.2.0.
              </Text>
            ) : (
              top.map(({ it, s }, i) => (
                <Pressable
                  key={it.id}
                  onPress={() => onOpenItem(it)}
                  style={[styles.topRow, i > 0 && { borderTopWidth: 1, borderTopColor: p.border }]}
                >
                  <Text style={[styles.rank, { color: p.muted }]}>{i + 1}</Text>
                  <Thumb item={it} />
                  <View style={{ flex: 1 }}>
                    <TypePill type={it.content_type} darkMode={darkMode} />
                    <Text style={[styles.topText, { color: p.text }]} numberOfLines={1}>
                      {it.content?.trim() || (it.content_type === "meme" ? "Meme" : "Video")}
                    </Text>
                    <Text style={[styles.topSub, { color: p.muted }]}>
                      {fmtNum(s!.impressions)} shown
                      {it.content_type === "video" ? ` · ${fmtNum(s!.views_3s)} views` : ""}
                    </Text>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <Text style={[styles.topPoints, { color: "#8b5cf6" }]}>{fmtNum(s!.points)}</Text>
                    <Text style={[styles.topSub, { color: p.muted }]}>points</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={p.muted} />
                </Pressable>
              ))
            )}
          </Card>

          <Card darkMode={darkMode}>
            <SectionTitle darkMode={darkMode} title="Your content" />
            <View style={styles.countRow}>
              {(["joke", "meme", "video"] as const).map((t) => (
                <View key={t} style={[styles.countBox, { backgroundColor: p.soft }]}>
                  <Text style={[styles.countValue, { color: p.text }]}>{counts[t]}</Text>
                  <TypePill type={t} darkMode={darkMode} />
                </View>
              ))}
            </View>
          </Card>

          <Text style={[styles.rules, { color: p.muted }]}>
            How points work: a joke or meme shown on screen = 1 point. Videos: watched 3 seconds = 1, half way = 3, to
            the end = 5. Each phone counts once per item per day. During testing, your own views count too.
          </Text>
        </>
      )}
    </ScrollView>
  );
}

export function Funnel({ totals, darkMode }: { totals: { impressions: number; views_3s: number; views_half: number; views_full: number }; darkMode: boolean }) {
  const p = palette(darkMode);
  const base = Math.max(1, totals.views_3s);
  const rows = [
    { label: "3 seconds", value: totals.views_3s, color: "#3b82f6" },
    { label: "Half way", value: totals.views_half, color: "#f59e0b" },
    { label: "To the end", value: totals.views_full, color: "#10b981" },
  ];
  return (
    <View style={{ gap: 8 }}>
      {rows.map((r) => (
        <View key={r.label} style={styles.funnelRow}>
          <Text style={[styles.funnelLabel, { color: p.muted }]}>{r.label}</Text>
          <View style={[styles.track, { flex: 1, backgroundColor: p.soft, marginTop: 0 }]}>
            <View style={[styles.fill, { width: `${(r.value / base) * 100}%`, backgroundColor: r.color }]} />
          </View>
          <Text style={[styles.funnelValue, { color: p.text }]}>{fmtNum(r.value)}</Text>
        </View>
      ))}
    </View>
  );
}

export function Thumb({ item, size = 40 }: { item: MyContentRow; size?: number }) {
  let uri: string | null = null;
  if (item.content_type === "meme" && item.image_path) uri = MEMES_BASE + item.image_path;
  if (item.content_type === "video") uri = videoFileUrl(item.image_path);
  if (!uri) return null;
  return (
    <View style={{ width: size, height: size, borderRadius: 8, overflow: "hidden", backgroundColor: "#000" }}>
      <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" />
      {item.content_type === "video" ? (
        <View style={styles.thumbPlay}>
          <MaterialIcons name="play-arrow" size={size * 0.45} color="#fff" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 30,
    gap: 12,
  },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#ede9fe",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoText: {
    color: "#5b21b6",
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
    flex: 1,
  },
  loadingBox: {
    paddingVertical: 60,
    alignItems: "center",
  },
  tiles: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  bigPct: {
    fontSize: 24,
    fontFamily: "OpenSans_600SemiBold",
  },
  track: {
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
    marginTop: 4,
  },
  fill: {
    height: "100%",
    borderRadius: 5,
    backgroundColor: "#8b5cf6",
  },
  note: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
    fontFamily: "OpenSans_400Regular",
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  rank: {
    width: 16,
    fontSize: 14,
    fontFamily: "OpenSans_600SemiBold",
    textAlign: "center",
  },
  topText: {
    fontSize: 14,
    fontFamily: "OpenSans_500Medium",
    marginTop: 3,
  },
  topSub: {
    fontSize: 11,
    fontFamily: "OpenSans_400Regular",
  },
  topPoints: {
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
  },
  countRow: {
    flexDirection: "row",
    gap: 10,
  },
  countBox: {
    flex: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
    gap: 4,
  },
  countValue: {
    fontSize: 20,
    fontFamily: "OpenSans_600SemiBold",
  },
  rules: {
    fontSize: 11,
    lineHeight: 16,
    fontFamily: "OpenSans_400Regular",
    paddingHorizontal: 4,
  },
  funnelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  funnelLabel: {
    width: 78,
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
  },
  funnelValue: {
    width: 50,
    textAlign: "right",
    fontSize: 13,
    fontFamily: "OpenSans_600SemiBold",
  },
  thumbPlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.25)",
  },
});
