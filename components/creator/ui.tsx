// Small shared pieces for the creator dashboard (My Jokes).

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

export const MEMES_BASE = "https://mknsvxajrvdlwqywvlrf.supabase.co/storage/v1/object/public/memes/";

export type MyContentRow = {
  id: string;
  content: string;
  created_at: string;
  is_new: boolean;
  is_visible: boolean;
  rating_bad_count: number | null;
  rating_meh_count: number | null;
  rating_good_count: number | null;
  rating_great_count: number | null;
  average: number | null;
  content_type: string | null;
  image_path: string | null;
  video_path: string | null;
};

export function palette(darkMode: boolean) {
  return {
    card: darkMode ? "#1b1b1b" : "#ffffff",
    border: darkMode ? "#333" : "#e2e2e2",
    text: darkMode ? "#f3f3f3" : "#111",
    muted: darkMode ? "#a8a8a8" : "#666",
    soft: darkMode ? "#262626" : "#f3f4f6",
    accent: "#1f5fd1",
    accentSoft: darkMode ? "#1d2a44" : "#eaf1ff",
  };
}

export function statusText(item: MyContentRow): string {
  if (item.is_visible) return "Approved";
  if (item.is_new) return "Pending review";
  return "Not approved";
}

export function statusColor(item: MyContentRow): string {
  if (item.is_visible) return "#2e7d32";
  if (item.is_new) return "#b26a00";
  return "#c62828";
}

export function typeLabel(type: string | null): string {
  if (type === "video") return "Video";
  if (type === "meme") return "Meme";
  return "Joke";
}

export function typeColors(type: string | null, darkMode: boolean) {
  if (type === "video") return darkMode ? { bg: "#16351f", fg: "#7ee2a1" } : { bg: "#dcfce7", fg: "#166534" };
  if (type === "meme") return darkMode ? { bg: "#3a1830", fg: "#f5a3d0" } : { bg: "#fce7f3", fg: "#9d174d" };
  return darkMode ? { bg: "#1f2550", fg: "#aab4ff" } : { bg: "#e0e7ff", fg: "#3730a3" };
}

export function TypePill({ type, darkMode }: { type: string | null; darkMode: boolean }) {
  const c = typeColors(type, darkMode);
  return (
    <View style={[styles.pill, { backgroundColor: c.bg }]}>
      <Text style={[styles.pillText, { color: c.fg }]}>{typeLabel(type).toUpperCase()}</Text>
    </View>
  );
}

// Row of pill buttons where one is selected.
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  darkMode,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  darkMode: boolean;
}) {
  const p = palette(darkMode);
  return (
    <View style={[styles.seg, { backgroundColor: p.soft }]}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[styles.segBtn, on && { backgroundColor: p.card }]}
            accessibilityState={{ selected: on }}
          >
            <Text style={[styles.segText, { color: on ? p.accent : p.muted }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// Tickable chips (metric choice for charts).
export function Chip({
  label,
  color,
  on,
  onPress,
  darkMode,
}: {
  label: string;
  color: string;
  on: boolean;
  onPress: () => void;
  darkMode: boolean;
}) {
  const p = palette(darkMode);
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { borderColor: on ? color : p.border, backgroundColor: on ? color + "22" : "transparent" },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.chipText, { color: on ? p.text : p.muted }]}>{label}</Text>
    </Pressable>
  );
}

export function Tile({
  label,
  value,
  sub,
  color,
  darkMode,
}: {
  label: string;
  value: string;
  sub?: string;
  color?: string;
  darkMode: boolean;
}) {
  const p = palette(darkMode);
  return (
    <View style={[styles.tile, { backgroundColor: p.card, borderColor: p.border }]}>
      <View style={styles.tileLabelRow}>
        {color ? <View style={[styles.dot, { backgroundColor: color }]} /> : null}
        <Text style={[styles.tileLabel, { color: p.muted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Text style={[styles.tileValue, { color: p.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {sub ? (
        <Text style={[styles.tileSub, { color: p.muted }]} numberOfLines={1}>
          {sub}
        </Text>
      ) : null}
    </View>
  );
}

export function Card({ children, darkMode }: { children: React.ReactNode; darkMode: boolean }) {
  const p = palette(darkMode);
  return <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>{children}</View>;
}

export function SectionTitle({ title, sub, darkMode }: { title: string; sub?: string; darkMode: boolean }) {
  const p = palette(darkMode);
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={[styles.sectionTitle, { color: p.text }]}>{title}</Text>
      {sub ? <Text style={[styles.sectionSub, { color: p.muted }]}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  pillText: {
    fontSize: 10,
    fontFamily: "OpenSans_600SemiBold",
    letterSpacing: 0.4,
  },
  seg: {
    flexDirection: "row",
    borderRadius: 10,
    padding: 3,
    gap: 2,
  },
  segBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: "center",
  },
  segText: {
    fontSize: 13,
    fontFamily: "OpenSans_600SemiBold",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "OpenSans_500Medium",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  tile: {
    flexBasis: "47%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  tileLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tileLabel: {
    fontSize: 11,
    fontFamily: "OpenSans_600SemiBold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  tileValue: {
    fontSize: 24,
    fontFamily: "OpenSans_600SemiBold",
    marginTop: 4,
  },
  tileSub: {
    fontSize: 11,
    fontFamily: "OpenSans_400Regular",
    marginTop: 1,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "OpenSans_600SemiBold",
  },
  sectionSub: {
    fontSize: 12,
    fontFamily: "OpenSans_400Regular",
    marginTop: 2,
  },
});
