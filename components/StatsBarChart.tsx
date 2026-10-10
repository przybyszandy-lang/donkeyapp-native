// Simple bar chart drawn with plain views (no extra packages).
// Tap a bar to see its exact value.

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { Bucket, fmtNum, Metric } from "../lib/creatorStats";

type Props = {
  buckets: Bucket[];
  metric: Metric;
  color: string;
  darkMode: boolean;
  height?: number;
};

export default function StatsBarChart({ buckets, metric, color, darkMode, height = 150 }: Props) {
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    setSelected(null);
  }, [buckets, metric]);

  const values = buckets.map((b) => b[metric]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, v) => a + v, 0);
  const many = buckets.length > 40;
  const gap = buckets.length > 90 ? 0 : buckets.length > 45 ? 1 : buckets.length > 20 ? 2 : 4;

  const labelIdx = new Set<number>();
  if (buckets.length > 0) {
    labelIdx.add(0);
    labelIdx.add(buckets.length - 1);
    if (buckets.length > 4) labelIdx.add(Math.floor((buckets.length - 1) / 2));
  }

  const muted = darkMode ? "#9a9a9a" : "#888";
  const grid = darkMode ? "#2c2c2c" : "#eee";

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.headerText, { color: muted }]}>
          {selected !== null && buckets[selected]
            ? `${buckets[selected].label}: `
            : "Total: "}
          <Text style={[styles.headerValue, { color: darkMode ? "#f3f3f3" : "#111" }]}>
            {fmtNum(selected !== null && buckets[selected] ? values[selected] : total)}
          </Text>
        </Text>
        <Text style={[styles.headerText, { color: muted }]}>max {fmtNum(max)}</Text>
      </View>

      <View style={[styles.plot, { height, borderColor: grid }]}>
        <View style={[styles.gridLine, { top: 0, backgroundColor: grid }]} />
        <View style={[styles.gridLine, { top: height / 2, backgroundColor: grid }]} />
        <View style={[styles.bars, { gap }]}>
          {buckets.map((b, i) => {
            const h = Math.max(values[i] > 0 ? 2 : 0, (values[i] / max) * (height - 4));
            const dim = selected !== null && selected !== i;
            return (
              <Pressable
                key={b.label + i}
                style={styles.barSlot}
                onPress={() => setSelected(selected === i ? null : i)}
                hitSlop={many ? 0 : 4}
              >
                <View
                  style={{
                    height: h,
                    backgroundColor: color,
                    opacity: dim ? 0.35 : 1,
                    borderTopLeftRadius: many ? 1 : 4,
                    borderTopRightRadius: many ? 1 : 4,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.labels}>
        {Array.from(labelIdx)
          .sort((x, y) => x - y)
          .map((i) => (
            <Text key={"l" + i} numberOfLines={1} style={[styles.labelText, { color: muted }]}>
              {buckets[i]?.label}
            </Text>
          ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  headerText: {
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
  },
  headerValue: {
    fontSize: 13,
    fontFamily: "OpenSans_600SemiBold",
  },
  plot: {
    borderBottomWidth: 1,
    justifyContent: "flex-end",
  },
  gridLine: {
    position: "absolute",
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  bars: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  barSlot: {
    flex: 1,
    height: "100%",
    justifyContent: "flex-end",
  },
  labels: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  labelText: {
    fontSize: 10,
    fontFamily: "OpenSans_400Regular",
  },
});
