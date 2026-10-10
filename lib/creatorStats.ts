// Creator statistics for the My Jokes dashboard.
// Reads the creator's OWN numbers through database functions
// (get_my_content_stats, get_my_views_daily, get_points_total).
// Rules for counting are in supabase/views-migration.sql.

import { supabase } from "./supabase";

export const STATS_FIRST_DAY = "2026-10-01"; // counting started after this

export type DayRow = {
  day: string;
  impressions: number;
  views_3s: number;
  views_half: number;
  views_full: number;
  points: number;
};

export type ItemStats = {
  joke_id: string;
  impressions: number;
  views_3s: number;
  views_half: number;
  views_full: number;
  points: number;
};

export type Totals = Omit<DayRow, "day">;

export type Metric = keyof Totals;
export type Grouping = "day" | "week" | "month" | "year";
export type Period = "7" | "30" | "90" | "all";

export const METRICS: { key: Metric; label: string; color: string }[] = [
  { key: "points", label: "Points", color: "#8b5cf6" },
  { key: "impressions", label: "Shown", color: "#64748b" },
  { key: "views_3s", label: "Video views", color: "#3b82f6" },
  { key: "views_half", label: "50% views", color: "#f59e0b" },
  { key: "views_full", label: "Full views", color: "#10b981" },
];

export const EMPTY_TOTALS: Totals = {
  impressions: 0,
  views_3s: 0,
  views_half: 0,
  views_full: 0,
  points: 0,
};

// ── Dates ────────────────────────────────────────────────────────────────
export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function todayIso(): string {
  return isoDay(new Date());
}
export function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return isoDay(d);
}
export function periodStart(period: Period): string {
  if (period === "all") return STATS_FIRST_DAY;
  const from = addDays(todayIso(), -(Number(period) - 1));
  return from < STATS_FIRST_DAY ? STATS_FIRST_DAY : from;
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

export function sumRows(rows: Totals[]): Totals {
  return rows.reduce<Totals>(
    (acc, r) => ({
      impressions: acc.impressions + num(r.impressions),
      views_3s: acc.views_3s + num(r.views_3s),
      views_half: acc.views_half + num(r.views_half),
      views_full: acc.views_full + num(r.views_full),
      points: acc.points + num(r.points),
    }),
    { ...EMPTY_TOTALS }
  );
}

// ── Grouping for charts ──────────────────────────────────────────────────
function bucketKey(day: string, g: Grouping): string {
  if (g === "day") return day;
  if (g === "month") return day.slice(0, 7);
  if (g === "year") return day.slice(0, 4);
  const d = new Date(day + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday first
  d.setUTCDate(d.getUTCDate() - dow);
  return isoDay(d);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function bucketLabel(key: string, g: Grouping): string {
  if (g === "year") return key;
  if (g === "month") return MONTHS[Number(key.slice(5, 7)) - 1] + " " + key.slice(2, 4);
  const day = Number(key.slice(8, 10));
  const mon = MONTHS[Number(key.slice(5, 7)) - 1];
  return `${day} ${mon}`;
}

export type Bucket = Totals & { label: string };

// Groups day rows into day / week / month / year buckets, filling gaps with 0.
export function groupDays(rows: DayRow[], from: string, to: string, g: Grouping): Bucket[] {
  const byDay = new Map(rows.map((r) => [r.day, r]));
  const buckets = new Map<string, Bucket>();
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const k = bucketKey(d, g);
    if (!buckets.has(k)) buckets.set(k, { label: bucketLabel(k, g), ...EMPTY_TOTALS });
    const r = byDay.get(d);
    if (r) {
      const b = buckets.get(k)!;
      b.impressions += num(r.impressions);
      b.views_3s += num(r.views_3s);
      b.views_half += num(r.views_half);
      b.views_full += num(r.views_full);
      b.points += num(r.points);
    }
  }
  return Array.from(buckets.values());
}

// ── Loading ──────────────────────────────────────────────────────────────
export async function loadMyItemStats(from: string, to: string): Promise<Map<string, ItemStats>> {
  const { data, error } = await supabase.rpc("get_my_content_stats", { p_from: from, p_to: to });
  if (error) throw error;
  const map = new Map<string, ItemStats>();
  ((data ?? []) as any[]).forEach((r) =>
    map.set(String(r.joke_id), {
      joke_id: String(r.joke_id),
      impressions: num(r.impressions),
      views_3s: num(r.views_3s),
      views_half: num(r.views_half),
      views_full: num(r.views_full),
      points: num(r.points),
    })
  );
  return map;
}

export async function loadMyDaily(jokeId: string | null, from: string, to: string): Promise<DayRow[]> {
  const { data, error } = await supabase.rpc("get_my_views_daily", {
    p_joke_id: jokeId,
    p_from: from,
    p_to: to,
  });
  if (error) throw error;
  return ((data ?? []) as any[]).map((r) => ({
    day: String(r.day),
    impressions: num(r.impressions),
    views_3s: num(r.views_3s),
    views_half: num(r.views_half),
    views_full: num(r.views_full),
    points: num(r.points),
  }));
}

export async function loadPointsTotal(from: string, to: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_points_total", { p_from: from, p_to: to });
  if (error) throw error;
  return num(data);
}

export async function loadIsAdmin(userId: string): Promise<boolean> {
  try {
    const { data, error } = await supabase.from("profiles").select("is_admin").eq("id", userId).single();
    return !error && data?.is_admin === true;
  } catch {
    return false;
  }
}

// ── Example data (made-up numbers for demonstrations) ────────────────────
function seeded(seed: number) {
  let s = seed % 233280;
  return () => (s = (s * 9301 + 49297) % 233280) / 233280;
}
function hash(text: string): number {
  let h = 7;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) % 1000003;
  return h;
}

// Made-up daily numbers for one item (or all content when contentType is null).
export function exampleDaily(
  key: string,
  contentType: string | null,
  from: string,
  to: string
): DayRow[] {
  const rnd = seeded(hash(key) + 11);
  const weight = contentType === null ? 1 : 0.15 + rnd() * 1.4;
  const out: DayRow[] = [];
  let i = 0;
  for (let d = from; d <= to; d = addDays(d, 1), i++) {
    const trend = 1 + i / 90;
    const weekend = [0, 6].includes(new Date(d + "T00:00:00Z").getUTCDay()) ? 1.25 : 1;
    const shown = Math.round((contentType === null ? 520 : 60) * weight * trend * weekend * (0.7 + rnd() * 0.6));
    const isVideo = contentType === null || contentType === "video";
    const v3 = isVideo ? Math.round(shown * (contentType === null ? 0.22 : 0.48)) : 0;
    const half = Math.round(v3 * 0.6);
    const full = Math.round(v3 * 0.36);
    let points: number;
    if (contentType === null) points = Math.round(shown * 0.8 + v3 * 0.3 + half * 0.6 + full * 1.4);
    else if (isVideo) points = (v3 - half) * 1 + (half - full) * 3 + full * 5;
    else points = shown;
    out.push({ day: d, impressions: shown, views_3s: v3, views_half: half, views_full: full, points });
  }
  return out;
}

// ── Formatting ───────────────────────────────────────────────────────────
export function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1) + "M";
  if (n >= 10_000) return Math.round(n / 1000) + "k";
  return Math.round(n).toLocaleString("en-GB");
}

export function pct(part: number, whole: number): string {
  if (!whole) return "–";
  return Math.round((part / whole) * 100) + "%";
}

// Average rating out of 4 (bad 1, meh 2, good 3, great 4).
export function averageRating(bad = 0, meh = 0, good = 0, great = 0): number | null {
  const votes = bad + meh + good + great;
  if (!votes) return null;
  return (bad * 1 + meh * 2 + good * 3 + great * 4) / votes;
}
