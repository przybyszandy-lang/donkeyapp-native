// Full-screen details for one of the creator's own items:
// picture/video preview, text, votes, totals, watch funnel and a chart
// grouped by day / week / month / year.

import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  addDays,
  averageRating,
  DayRow,
  exampleDaily,
  fmtNum,
  groupDays,
  Grouping,
  loadMyDaily,
  Metric,
  METRICS,
  STATS_FIRST_DAY,
  sumRows,
  todayIso,
} from "../../lib/creatorStats";
import { videoFileUrl } from "../../lib/video";
import StatsBarChart from "../StatsBarChart";
import { Funnel } from "./CreatorDashboard";
import {
  Card,
  Chip,
  MEMES_BASE,
  MyContentRow,
  palette,
  SectionTitle,
  Segmented,
  statusColor,
  statusText,
  Tile,
  TypePill,
} from "./ui";

type Props = {
  item: MyContentRow | null;
  darkMode: boolean;
  demo: boolean;
  onClose: () => void;
};

export default function ContentDetail({ item, darkMode, demo, onClose }: Props) {
  const p = palette(darkMode);
  const insets = useSafeAreaInsets();
  const [daily, setDaily] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [grouping, setGrouping] = useState<Grouping>("day");
  const [metric, setMetric] = useState<Metric>("impressions");

  const to = todayIso();
  const created = item?.created_at ? String(item.created_at).slice(0, 10) : STATS_FIRST_DAY;
  const from = demo ? addDays(to, -364) : created > STATS_FIRST_DAY ? created : STATS_FIRST_DAY;
  const isVideo = item?.content_type === "video";

  useEffect(() => {
    if (!item) return;
    let cancelled = false;
    setError(null);
    // Long histories read better by week or month.
    const span = (Date.parse(to) - Date.parse(from)) / 86400000;
    setGrouping(span > 180 ? "month" : span > 45 ? "week" : "day");
    setMetric(isVideo ? "views_3s" : "impressions");

    if (demo) {
      setDaily(exampleDaily(item.id, item.content_type ?? "joke", from, to));
      return;
    }
    setLoading(true);
    loadMyDaily(item.id, from, to)
      .then((rows) => {
        if (!cancelled) setDaily(rows);
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? "Could not load stats.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, demo]);

  const all = useMemo(() => sumRows(daily), [daily]);
  const month = useMemo(() => sumRows(daily.filter((r) => r.day.slice(0, 7) === to.slice(0, 7))), [daily, to]);
  const today = useMemo(() => sumRows(daily.filter((r) => r.day === to)), [daily, to]);
  const buckets = useMemo(() => groupDays(daily, from, to, grouping), [daily, from, to, grouping]);

  if (!item) return null;

  const bad = item.rating_bad_count ?? 0;
  const meh = item.rating_meh_count ?? 0;
  const good = item.rating_good_count ?? 0;
  const great = item.rating_great_count ?? 0;
  const votes = bad + meh + good + great;
  const avg = averageRating(bad, meh, good, great);

  let imageUri: string | null = null;
  if (item.content_type === "meme" && item.image_path) imageUri = MEMES_BASE + item.image_path;
  if (isVideo) imageUri = videoFileUrl(item.image_path);

  const metrics = METRICS.filter((m) => isVideo || ["points", "impressions"].includes(m.key));
  const metricInfo = METRICS.find((m) => m.key === metric) ?? METRICS[0];
  const text = item.content?.trim() ?? "";

  return (
    <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
      <View style={[styles.screen, { backgroundColor: darkMode ? "#101010" : "#efefef", paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={12} style={[styles.closeBtn, { backgroundColor: p.card, borderColor: p.border }]}>
            <MaterialIcons name="arrow-back" size={22} color={p.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: p.text }]}>Statistics</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 30 }]}>
          {demo ? (
            <View style={styles.demoBanner}>
              <Text style={styles.demoText}>Example data — made-up numbers for demonstration.</Text>
            </View>
          ) : null}

          <Card darkMode={darkMode}>
            <View style={styles.topRow}>
              <TypePill type={item.content_type} darkMode={darkMode} />
              <Text style={[styles.status, { color: statusColor(item) }]}>{statusText(item)}</Text>
            </View>
            {imageUri || isVideo ? (
              <View style={styles.mediaBox}>
                {imageUri ? (
                  <Image source={{ uri: imageUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
                ) : null}
                {isVideo ? (
                  <View style={styles.playBadge}>
                    <MaterialIcons name="play-arrow" size={30} color="#fff" />
                  </View>
                ) : null}
              </View>
            ) : null}
            {text ? <Text style={[styles.text, { color: p.text }]}>{text}</Text> : null}
            <Text style={[styles.meta, { color: p.muted }]}>
              Added{" "}
              {new Date(item.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </Text>
          </Card>

          <View style={styles.tiles}>
            <Tile darkMode={darkMode} label="Points" color="#8b5cf6" value={fmtNum(all.points)} sub={`${fmtNum(month.points)} this month`} />
            <Tile darkMode={darkMode} label="Shown" color="#64748b" value={fmtNum(all.impressions)} sub={`${fmtNum(today.impressions)} today`} />
            {isVideo ? (
              <>
                <Tile darkMode={darkMode} label="Video views" color="#3b82f6" value={fmtNum(all.views_3s)} sub={`${fmtNum(month.views_3s)} this month`} />
                <Tile darkMode={darkMode} label="Full views" color="#10b981" value={fmtNum(all.views_full)} sub={`${fmtNum(all.views_half)} watched half`} />
              </>
            ) : null}
          </View>

          <Card darkMode={darkMode}>
            <View style={styles.rowBetween}>
              <SectionTitle darkMode={darkMode} title="Votes" sub={`${fmtNum(votes)} votes`} />
              <Text style={[styles.avg, { color: p.text }]}>{avg ? avg.toFixed(2) : "–"}<Text style={{ fontSize: 13, color: p.muted }}> / 4</Text></Text>
            </View>
            {[
              { e: "😂", n: great, c: "#10b981" },
              { e: "🙂", n: good, c: "#3b82f6" },
              { e: "😐", n: meh, c: "#f59e0b" },
              { e: "😕", n: bad, c: "#ef4444" },
            ].map((v) => (
              <View key={v.e} style={styles.voteRow}>
                <Text style={styles.voteEmoji}>{v.e}</Text>
                <View style={[styles.track, { backgroundColor: p.soft }]}>
                  <View style={[styles.fill, { width: `${votes ? (v.n / votes) * 100 : 0}%`, backgroundColor: v.c }]} />
                </View>
                <Text style={[styles.voteCount, { color: p.text }]}>{fmtNum(v.n)}</Text>
              </View>
            ))}
          </Card>

          {isVideo && all.views_3s > 0 ? (
            <Card darkMode={darkMode}>
              <SectionTitle darkMode={darkMode} title="How far people watch" sub="All time" />
              <Funnel darkMode={darkMode} totals={all} />
            </Card>
          ) : null}

          <Card darkMode={darkMode}>
            <SectionTitle darkMode={darkMode} title="Over time" sub="Since it was added · tap a bar to see its number" />
            {loading ? (
              <View style={{ paddingVertical: 40 }}>
                <ActivityIndicator />
              </View>
            ) : error ? (
              <Text style={{ color: "#c62828" }}>{error}</Text>
            ) : (
              <>
                <View style={styles.chips}>
                  {metrics.map((m) => (
                    <Chip key={m.key} darkMode={darkMode} label={m.label} color={m.color} on={metric === m.key} onPress={() => setMetric(m.key)} />
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
              </>
            )}
          </Card>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "OpenSans_600SemiBold",
  },
  content: {
    paddingHorizontal: 16,
    gap: 12,
  },
  demoBanner: {
    backgroundColor: "#ede9fe",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  demoText: {
    color: "#5b21b6",
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  status: {
    fontSize: 12,
    fontFamily: "OpenSans_600SemiBold",
  },
  mediaBox: {
    width: "100%",
    aspectRatio: 4 / 5,
    maxHeight: 360,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    fontSize: 16,
    lineHeight: 23,
    fontFamily: "OpenSans_400Regular",
  },
  meta: {
    fontSize: 12,
    marginTop: 8,
    fontFamily: "OpenSans_400Regular",
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
  avg: {
    fontSize: 24,
    fontFamily: "OpenSans_600SemiBold",
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 6,
  },
  voteEmoji: {
    fontSize: 18,
    width: 26,
  },
  voteCount: {
    width: 44,
    textAlign: "right",
    fontSize: 13,
    fontFamily: "OpenSans_600SemiBold",
  },
  track: {
    flex: 1,
    height: 10,
    borderRadius: 5,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 5,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
});
