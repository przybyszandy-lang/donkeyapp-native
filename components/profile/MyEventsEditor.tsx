// "My events" card on My Profile: list upcoming events, add / edit / delete.
import DateTimePicker, { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  CreatorEvent,
  deleteEvent,
  eventDateText,
  fetchMyEvents,
  saveEvent,
  tidyWebsite,
} from "../../lib/profile";
import { palette } from "../creator/ui";

type Draft = {
  id?: string;
  title: string;
  venue: string;
  city: string;
  startsAt: Date;
  ticketUrl: string;
};

function newDraft(): Draft {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  d.setHours(20, 0, 0, 0);
  return { title: "", venue: "", city: "", startsAt: d, ticketUrl: "" };
}

export default function MyEventsEditor({ darkMode, textScale }: { darkMode: boolean; textScale: number }) {
  const p = palette(darkMode);
  const [events, setEvents] = useState<CreatorEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setEvents(await fetchMyEvents());
    } catch (e) {
      console.log("Failed to load my events:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (e: CreatorEvent) =>
    setDraft({
      id: e.id,
      title: e.title,
      venue: e.venue ?? "",
      city: e.city ?? "",
      startsAt: new Date(e.starts_at),
      ticketUrl: e.ticket_url ?? "",
    });

  const pickAndroid = () => {
    if (!draft) return;
    DateTimePickerAndroid.open({
      value: draft.startsAt,
      mode: "date",
      minimumDate: new Date(),
      onChange: (ev, date) => {
        if (ev.type !== "set" || !date) return;
        DateTimePickerAndroid.open({
          value: date,
          mode: "time",
          is24Hour: true,
          onChange: (ev2, time) => {
            if (ev2.type !== "set" || !time) return;
            setDraft((d) => (d ? { ...d, startsAt: time } : d));
          },
        });
      },
    });
  };

  const onSave = async () => {
    if (!draft) return;
    const title = draft.title.trim();
    if (!title) {
      Alert.alert("Event", "Please enter a title.");
      return;
    }
    if (draft.startsAt.getTime() < Date.now() - 3600 * 1000) {
      Alert.alert("Event", "Please choose a date in the future.");
      return;
    }
    const link = tidyWebsite(draft.ticketUrl);
    if (link.error) {
      Alert.alert("Ticket link", link.error);
      return;
    }
    try {
      setSaving(true);
      await saveEvent(
        {
          title,
          venue: draft.venue.trim() || null,
          city: draft.city.trim() || null,
          starts_at: draft.startsAt.toISOString(),
          ticket_url: link.value,
        },
        draft.id
      );
      setDraft(null);
      await load();
    } catch (e: any) {
      console.log("Save event failed:", e);
      Alert.alert("Event", e?.message?.includes("up to 30") ? e.message : "Could not save the event. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (e: CreatorEvent) => {
    Alert.alert("Delete event?", e.title, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEvent(e.id);
            setDraft(null);
            await load();
          } catch (err) {
            console.log("Delete event failed:", err);
            Alert.alert("Event", "Could not delete the event.");
          }
        },
      },
    ]);
  };

  const label = [styles.label, { color: p.text, fontSize: 14 * textScale }];
  const input = [
    styles.input,
    { backgroundColor: p.card, borderColor: p.border, color: p.text, fontSize: 15 * textScale },
  ];

  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
      <View style={styles.headerRow}>
        <Text style={[label, { marginBottom: 0 }]}>My events</Text>
        <Pressable style={styles.addButton} onPress={() => setDraft(newDraft())} hitSlop={6}>
          <Text style={styles.addText}>+ Add event</Text>
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: p.muted, fontSize: 12 * textScale }]}>
        Shows, gigs or live streams. Upcoming events appear on your public profile.
      </Text>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 10 }} />
      ) : events.length === 0 ? (
        <Text style={[styles.empty, { color: p.muted, fontSize: 14 * textScale }]}>No upcoming events.</Text>
      ) : (
        events.map((e) => (
          <Pressable key={e.id} style={[styles.event, { backgroundColor: p.soft }]} onPress={() => openEdit(e)}>
            <Text style={[styles.eventDate, { color: p.accent, fontSize: 12 * textScale }]}>
              {eventDateText(e.starts_at)}
            </Text>
            <Text style={[styles.eventTitle, { color: p.text, fontSize: 15 * textScale }]}>{e.title}</Text>
            {e.venue || e.city ? (
              <Text style={[styles.eventPlace, { color: p.muted, fontSize: 13 * textScale }]}>
                {[e.venue, e.city].filter(Boolean).join(", ")}
              </Text>
            ) : null}
          </Pressable>
        ))
      )}

      <Modal visible={!!draft} transparent animationType="slide" onRequestClose={() => setDraft(null)}>
        <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <View style={[styles.sheet, { backgroundColor: p.card }]}>
            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={[styles.sheetTitle, { color: p.text }]}>{draft?.id ? "Edit event" : "New event"}</Text>

              <Text style={label}>Title</Text>
              <TextInput
                style={input}
                value={draft?.title ?? ""}
                onChangeText={(v) => setDraft((d) => (d ? { ...d, title: v } : d))}
                maxLength={80}
                placeholder="e.g. Stand-up night"
                placeholderTextColor={p.muted}
              />

              <Text style={[label, styles.spaced]}>Date and time</Text>
              {Platform.OS === "ios" ? (
                <DateTimePicker
                  value={draft?.startsAt ?? new Date()}
                  mode="datetime"
                  display="spinner"
                  minimumDate={new Date()}
                  minuteInterval={5}
                  themeVariant={darkMode ? "dark" : "light"}
                  onChange={(_, date) => date && setDraft((d) => (d ? { ...d, startsAt: date } : d))}
                  style={styles.iosPicker}
                />
              ) : (
                <Pressable style={input} onPress={pickAndroid}>
                  <Text style={{ color: p.text, fontSize: 15 * textScale }}>
                    {draft ? eventDateText(draft.startsAt.toISOString()) : ""}
                  </Text>
                </Pressable>
              )}

              <Text style={[label, styles.spaced]}>Venue</Text>
              <TextInput
                style={input}
                value={draft?.venue ?? ""}
                onChangeText={(v) => setDraft((d) => (d ? { ...d, venue: v } : d))}
                maxLength={80}
                placeholder="Optional"
                placeholderTextColor={p.muted}
              />

              <Text style={[label, styles.spaced]}>City</Text>
              <TextInput
                style={input}
                value={draft?.city ?? ""}
                onChangeText={(v) => setDraft((d) => (d ? { ...d, city: v } : d))}
                maxLength={60}
                placeholder="Optional"
                placeholderTextColor={p.muted}
              />

              <Text style={[label, styles.spaced]}>Ticket link</Text>
              <TextInput
                style={input}
                value={draft?.ticketUrl ?? ""}
                onChangeText={(v) => setDraft((d) => (d ? { ...d, ticketUrl: v } : d))}
                maxLength={200}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                placeholder="Optional"
                placeholderTextColor={p.muted}
              />

              <View style={styles.buttons}>
                <Pressable style={[styles.button, { backgroundColor: "#757575" }]} onPress={() => setDraft(null)}>
                  <Text style={styles.buttonText}>Cancel</Text>
                </Pressable>
                <Pressable
                  style={[styles.button, { backgroundColor: saving ? "#9e9e9e" : "#2e7d32" }]}
                  onPress={onSave}
                  disabled={saving}
                >
                  <Text style={styles.buttonText}>{saving ? "Saving…" : "Save"}</Text>
                </Pressable>
              </View>

              {draft?.id ? (
                <Pressable
                  style={styles.deleteLink}
                  onPress={() => {
                    const e = events.find((x) => x.id === draft.id);
                    if (e) onDelete(e);
                  }}
                >
                  <Text style={styles.deleteText}>Delete event</Text>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16 },
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  label: { fontFamily: "OpenSans_600SemiBold", marginBottom: 6 },
  hint: { fontFamily: "OpenSans_400Regular", marginTop: 4, marginBottom: 6 },
  addButton: { backgroundColor: "#1f5fd1", paddingVertical: 7, paddingHorizontal: 12, borderRadius: 8 },
  addText: { color: "#fff", fontSize: 13, fontFamily: "OpenSans_600SemiBold" },
  empty: { fontFamily: "OpenSans_400Regular", marginTop: 6 },
  event: { borderRadius: 10, padding: 10, marginTop: 8 },
  eventDate: { fontFamily: "OpenSans_600SemiBold" },
  eventTitle: { fontFamily: "OpenSans_600SemiBold", marginTop: 2 },
  eventPlace: { fontFamily: "OpenSans_400Regular", marginTop: 1 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  sheet: { borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 20, maxHeight: "92%" },
  sheetTitle: { fontSize: 18, fontFamily: "OpenSans_600SemiBold", marginBottom: 14 },
  spaced: { marginTop: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "OpenSans_400Regular",
  },
  iosPicker: { height: 180 },
  buttons: { flexDirection: "row", gap: 10, marginTop: 20 },
  button: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: "center" },
  buttonText: { color: "#fff", fontSize: 15, fontFamily: "OpenSans_600SemiBold" },
  deleteLink: { alignItems: "center", paddingVertical: 14 },
  deleteText: { color: "#c62828", fontSize: 14, fontFamily: "OpenSans_600SemiBold" },
});
