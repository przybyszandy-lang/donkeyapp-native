// "Profile" tab of My Profile: picture, display name, about me, website,
// link to the public profile and Delete Account (moved here from Settings).
import { FontAwesome6, MaterialIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { setCachedAvatar } from "../../lib/follows";
import {
  BIO_MAX,
  fetchMyProfile,
  pickAndUploadAvatar,
  removeAvatar,
  SocialKey,
  SOCIALS,
  tidyHandle,
  tidyWebsite,
  WEBSITE_MAX,
} from "../../lib/profile";
import { supabase } from "../../lib/supabase";
import { palette } from "../creator/ui";
import Avatar from "./Avatar";
import MyEventsEditor from "./MyEventsEditor";

const NAME_MAX = 25;

export default function MyProfileEditor({
  userId,
  darkMode,
  textScale,
}: {
  userId: string;
  darkMode: boolean;
  textScale: number;
}) {
  const p = palette(darkMode);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pictureBusy, setPictureBusy] = useState(false);

  const [avatarUpdatedAt, setAvatarUpdatedAt] = useState<string | null>(null);
  const emptySocials: Record<SocialKey, string> = { instagram: "", tiktok: "", youtube: "", x_handle: "", facebook: "" };
  const [saved, setSaved] = useState({ name: "", bio: "", website: "", socials: emptySocials });
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [socials, setSocials] = useState<Record<SocialKey, string>>(emptySocials);
  const [showFollowers, setShowFollowers] = useState(true);
  const [showFollowing, setShowFollowing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const profile = await fetchMyProfile(userId);
        if (cancelled) return;
        const loadedSocials: Record<SocialKey, string> = {
          instagram: profile.instagram,
          tiktok: profile.tiktok,
          youtube: profile.youtube,
          x_handle: profile.x_handle,
          facebook: profile.facebook,
        };
        setAvatarUpdatedAt(profile.avatar_updated_at);
        setSaved({ name: profile.display_name, bio: profile.bio, website: profile.website, socials: loadedSocials });
        setName(profile.display_name);
        setBio(profile.bio);
        setWebsite(profile.website);
        setSocials(loadedSocials);
        setShowFollowers(profile.show_followers);
        setShowFollowing(profile.show_following);
      } catch (e) {
        console.log("Failed to load my profile:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const changed =
    name !== saved.name ||
    bio !== saved.bio ||
    website !== saved.website ||
    SOCIALS.some((x) => socials[x.key] !== saved.socials[x.key]);

  const savePrivacy = async (field: "show_followers" | "show_following", value: boolean) => {
    const setter = field === "show_followers" ? setShowFollowers : setShowFollowing;
    setter(value);
    const { error } = await supabase
      .from("profiles")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", userId);
    if (error) {
      console.log("Privacy save failed:", error);
      setter(!value);
      Alert.alert("Error", "Could not save this setting. Please try again.");
    }
  };

  const onChangePicture = () => {
    Alert.alert("Profile picture", undefined, [
      { text: "Take photo", onPress: () => uploadPicture("camera") },
      { text: "Choose from library", onPress: () => uploadPicture("library") },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const uploadPicture = async (source: "camera" | "library") => {
    try {
      setPictureBusy(true);
      const updatedAt = await pickAndUploadAvatar(userId, source);
      if (updatedAt) {
        setAvatarUpdatedAt(updatedAt);
        setCachedAvatar(userId, updatedAt);
      }
    } catch (e: any) {
      console.log("Profile picture upload failed:", e);
      Alert.alert("Profile picture", e?.message ?? "Could not upload the picture. Please try again.");
    } finally {
      setPictureBusy(false);
    }
  };

  const onRemovePicture = () => {
    Alert.alert("Remove profile picture?", "Your initial will be shown instead.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            setPictureBusy(true);
            await removeAvatar(userId);
            setAvatarUpdatedAt(null);
            setCachedAvatar(userId, null);
          } catch (e: any) {
            console.log("Remove picture failed:", e);
            Alert.alert("Profile picture", "Could not remove the picture. Please try again.");
          } finally {
            setPictureBusy(false);
          }
        },
      },
    ]);
  };

  const onSave = async () => {
    const cleanName = name.trim();
    const cleanBio = bio.trim();
    if (!cleanName) {
      Alert.alert("Display name required", "Please enter at least 1 character.");
      return;
    }
    const site = tidyWebsite(website);
    if (site.error) {
      Alert.alert("Website", site.error);
      return;
    }
    const cleanSocials = { ...emptySocials };
    const socialValues: Record<string, string | null> = {};
    for (const x of SOCIALS) {
      const r = tidyHandle(x.key, socials[x.key]);
      if (r.error) {
        Alert.alert(x.label, r.error);
        return;
      }
      cleanSocials[x.key] = r.value ?? "";
      socialValues[x.key] = r.value;
    }

    try {
      setSaving(true);
      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          bio: cleanBio || null,
          website: site.value,
          ...socialValues,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (error) throw error;

      const next = { name: cleanName, bio: cleanBio, website: site.value ?? "", socials: cleanSocials };
      setSaved(next);
      setName(next.name);
      setBio(next.bio);
      setWebsite(next.website);
      setSocials(cleanSocials);
      Alert.alert("Saved", "Your profile has been updated.");
    } catch (e: any) {
      console.log("Save profile failed:", e);
      if (e?.code === "23505") {
        Alert.alert("Display name unavailable", "This display name is already in use. Please choose another one.");
      } else {
        Alert.alert("Error", "Failed to save your profile. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const label = [styles.label, { color: p.text, fontSize: 14 * textScale }];
  const input = [
    styles.input,
    { backgroundColor: p.card, borderColor: p.border, color: p.text, fontSize: 15 * textScale },
  ];
  const hint = [styles.hint, { color: p.muted, fontSize: 12 * textScale }];

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={100}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Picture */}
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <View style={styles.pictureRow}>
            <View>
              <Avatar userId={userId} updatedAt={avatarUpdatedAt} name={saved.name} size={84} />
              {pictureBusy ? (
                <View style={styles.pictureBusy}>
                  <ActivityIndicator color="#fff" />
                </View>
              ) : null}
            </View>
            <View style={styles.pictureButtons}>
              <Pressable
                style={[styles.smallButton, { backgroundColor: p.accent }]}
                onPress={onChangePicture}
                disabled={pictureBusy}
              >
                <Text style={[styles.smallButtonText, { fontSize: 14 * textScale }]}>
                  {avatarUpdatedAt ? "Change picture" : "Add picture"}
                </Text>
              </Pressable>
              {avatarUpdatedAt ? (
                <Pressable onPress={onRemovePicture} disabled={pictureBusy} hitSlop={8}>
                  <Text style={[styles.removeText, { fontSize: 13 * textScale }]}>Remove picture</Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </View>

        {/* Details */}
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={label}>Display name</Text>
          <TextInput
            style={input}
            value={name}
            onChangeText={setName}
            maxLength={NAME_MAX}
            autoCorrect={false}
            placeholder="Display name"
            placeholderTextColor={p.muted}
          />

          <Text style={[label, styles.spaced]}>About me</Text>
          <TextInput
            style={[input, styles.bioInput]}
            value={bio}
            onChangeText={setBio}
            maxLength={BIO_MAX}
            multiline
            placeholder="Tell people a little about yourself"
            placeholderTextColor={p.muted}
          />
          <Text style={hint}>
            {bio.length} / {BIO_MAX} · the first 100 characters show on your profile, the rest under &quot;more&quot;
          </Text>

          <Text style={[label, styles.spaced]}>Website</Text>
          <TextInput
            style={input}
            value={website}
            onChangeText={setWebsite}
            maxLength={WEBSITE_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            placeholder="e.g. mysite.com (optional)"
            placeholderTextColor={p.muted}
          />

          <Text style={[label, styles.spaced]}>Social media</Text>
          <Text style={[hint, styles.hintTop]}>Username or link. Only the ones you fill in are shown.</Text>
          {SOCIALS.map((x) => (
            <View key={x.key} style={styles.socialInputRow}>
              <View style={[styles.socialIcon, { backgroundColor: p.soft }]}>
                <FontAwesome6 name={x.icon} brand size={16} color={p.text} />
              </View>
              <TextInput
                style={[input, styles.flex]}
                value={socials[x.key]}
                onChangeText={(v) => setSocials((prev) => ({ ...prev, [x.key]: v }))}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={120}
                placeholder={`${x.label} username`}
                placeholderTextColor={p.muted}
              />
            </View>
          ))}

          <Pressable
            style={[styles.saveButton, { backgroundColor: changed && !saving ? "#2e7d32" : "#9e9e9e" }]}
            onPress={onSave}
            disabled={!changed || saving}
          >
            <Text style={[styles.saveButtonText, { fontSize: 15 * textScale }]}>
              {saving ? "Saving…" : changed ? "Save changes" : "Saved"}
            </Text>
          </Pressable>
        </View>

        {/* Followers privacy */}
        <View style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]}>
          <Text style={[label, { marginBottom: 2 }]}>Privacy</Text>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: p.text, fontSize: 14 * textScale }]}>
              Others can see who follows me
            </Text>
            <Switch value={showFollowers} onValueChange={(v) => savePrivacy("show_followers", v)} />
          </View>
          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: p.text, fontSize: 14 * textScale }]}>
              Others can see who I follow
            </Text>
            <Switch value={showFollowing} onValueChange={(v) => savePrivacy("show_following", v)} />
          </View>
          <Text style={hint}>The number of followers is always shown.</Text>
        </View>

        {/* Events */}
        <MyEventsEditor darkMode={darkMode} textScale={textScale} />

        {/* Public profile */}
        <Pressable
          style={[styles.row, { backgroundColor: p.card, borderColor: p.border }]}
          onPress={() => router.push(`/profile/${userId}`)}
        >
          <Text style={[styles.rowText, { color: p.text, fontSize: 15 * textScale }]}>
            View my public profile
          </Text>
          <MaterialIcons name="chevron-right" size={20} color={p.muted} />
        </Pressable>

        {/* Delete account (moved from Settings) */}
        <Pressable
          style={[
            styles.row,
            styles.deleteRow,
            darkMode && { backgroundColor: "#2a1515", borderColor: "#6b2a2a" },
          ]}
          onPress={() => router.push("/delete-account")}
        >
          <Text style={[styles.deleteText, { fontSize: 15 * textScale }, darkMode && { color: "#ff8a8a" }]}>
            Delete Account
          </Text>
          <MaterialIcons name="chevron-right" size={20} color={darkMode ? "#ff8a8a" : "#ffffff"} />
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { paddingTop: 40, alignItems: "center" },
  content: { paddingBottom: 40, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
  },
  pictureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  pictureBusy: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 42,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  pictureButtons: {
    flex: 1,
    gap: 10,
    alignItems: "flex-start",
  },
  smallButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
  },
  smallButtonText: {
    color: "#fff",
    fontFamily: "OpenSans_600SemiBold",
  },
  removeText: {
    color: "#c62828",
    fontFamily: "OpenSans_600SemiBold",
  },
  label: {
    fontFamily: "OpenSans_600SemiBold",
    marginBottom: 6,
  },
  spaced: { marginTop: 14 },
  hintTop: { marginTop: 0, marginBottom: 8 },
  socialInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },
  socialIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: 12,
  },
  switchLabel: {
    flex: 1,
    fontFamily: "OpenSans_400Regular",
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: "OpenSans_400Regular",
  },
  bioInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  hint: {
    marginTop: 4,
    fontFamily: "OpenSans_400Regular",
  },
  saveButton: {
    marginTop: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  saveButtonText: {
    color: "#fff",
    fontFamily: "OpenSans_600SemiBold",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  rowText: {
    fontFamily: "OpenSans_600SemiBold",
  },
  deleteRow: {
    backgroundColor: "#c62828",
    borderColor: "#c62828",
  },
  deleteText: {
    color: "#fff",
    fontFamily: "OpenSans_600SemiBold",
  },
});
