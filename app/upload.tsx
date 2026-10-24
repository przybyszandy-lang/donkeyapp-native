// Upload a meme or a video (opened from the Add Content tab with ?type=meme or ?type=video).
// Everything is checked by Andy before it appears, unless the uploader is trusted.
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { LANGUAGE_OPTIONS } from "../lib/languages";
import { supabase } from "../lib/supabase";
import {
  MAX_DESCRIPTION,
  MAX_VIDEO_SECONDS,
  PreparedUpload,
  UploadType,
  pickMeme,
  pickVideo,
  submitUpload,
  uploadErrorMessage,
} from "../lib/uploads";

const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";
const ADD_JOKE_LANGUAGE_KEY = "donkey:add-joke-language:v1";

export default function UploadScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const type: UploadType = params.type === "video" ? "video" : "meme";
  const word = type === "meme" ? "meme" : "video";

  const [darkMode, setDarkMode] = useState(false);
  const [textScale, setTextScale] = useState(1);

  const [userId, setUserId] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [prepared, setPrepared] = useState<PreparedUpload | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [prepProgress, setPrepProgress] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [languageOpen, setLanguageOpen] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [result, setResult] = useState<"pending" | "published" | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [rawDark, rawText, savedLang] = await Promise.all([
          AsyncStorage.getItem(DARK_MODE_KEY),
          AsyncStorage.getItem(TEXT_SIZE_KEY),
          AsyncStorage.getItem(ADD_JOKE_LANGUAGE_KEY),
        ]);
        setDarkMode(rawDark === "true");
        setTextScale(rawText === "Small" ? 0.9 : rawText === "Large" ? 1.2 : 1);
        if (savedLang && LANGUAGE_OPTIONS.includes(savedLang)) setLanguage(savedLang);
      } catch {
        // keep defaults
      }
    })();

    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null);
      setAuthChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const choose = async (source: "camera" | "library") => {
    if (preparing || uploading) return;
    setErrorText(null);
    setPreparing(true);
    setPrepProgress(null);
    try {
      const picked =
        type === "meme"
          ? await pickMeme(source)
          : await pickVideo(source, (fraction) => setPrepProgress(fraction));
      if (picked) setPrepared(picked);
    } catch (e: any) {
      setErrorText(uploadErrorMessage(e));
    } finally {
      setPreparing(false);
      setPrepProgress(null);
    }
  };

  const submit = async () => {
    if (!userId || !prepared || !agreed || uploading) return;
    setErrorText(null);
    setUploading(true);
    try {
      const status = await submitUpload(userId, prepared, description, language);
      setResult(status);
    } catch (e: any) {
      setErrorText(uploadErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const startAgain = () => {
    setPrepared(null);
    setDescription("");
    setAgreed(false);
    setErrorText(null);
    setResult(null);
  };

  const t = (size: number) => ({ fontSize: size * textScale });
  const light = darkMode && styles.textLight;
  const muted = darkMode && styles.textMuted;

  const backButton = (
    <Pressable
      style={[styles.backButton, darkMode && styles.boxDark]}
      onPress={() => (router.canGoBack() ? router.back() : router.navigate("/(tabs)/add-content"))}
      disabled={uploading}
    >
      <Text style={[styles.backButtonText, t(15), light]}>← Back</Text>
    </Pressable>
  );

  // ----- Finished -----
  if (result) {
    return (
      <ScrollView
        style={[styles.screen, darkMode && styles.screenDark]}
        contentContainerStyle={styles.content}
      >
        {backButton}
        <View style={[styles.box, darkMode && styles.boxDark, styles.doneBox]}>
          <MaterialIcons name="check-circle" size={48} color="#2e7d32" />
          <Text style={[styles.doneTitle, t(20), light]}>Thank you!</Text>
          <Text style={[styles.doneText, t(15), muted]}>
            {result === "published"
              ? `Your ${word} is now live.`
              : `Your ${word} has been sent for approval. Every upload is checked by hand, so it may take a little while before it appears. You can see its status in My Profile → Content.`}
          </Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={startAgain}>
          <Text style={[styles.primaryButtonText, t(16)]}>Upload another {word}</Text>
        </Pressable>
        <Pressable
          style={[styles.secondaryButton, darkMode && styles.boxDark]}
          onPress={() => router.navigate("/(tabs)/my-jokes")}
        >
          <Text style={[styles.secondaryButtonText, t(15), light]}>Go to My Profile</Text>
        </Pressable>
      </ScrollView>
    );
  }

  // ----- Not signed in -----
  if (authChecked && !userId) {
    return (
      <ScrollView
        style={[styles.screen, darkMode && styles.screenDark]}
        contentContainerStyle={styles.content}
      >
        {backButton}
        <Text style={[styles.title, t(22), light]}>Add a {word}</Text>
        <View style={[styles.box, darkMode && styles.boxDark]}>
          <Text style={[styles.bodyText, t(15), light]}>
            Please sign in to upload memes and videos. Open the menu on the Home page and tap
            “Sign In / Up”.
          </Text>
        </View>
        <Pressable style={styles.primaryButton} onPress={() => router.navigate("/(tabs)")}>
          <Text style={[styles.primaryButtonText, t(16)]}>Go to Home</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const previewUri = prepared
    ? prepared.type === "meme"
      ? prepared.previewUri
      : prepared.posterUri
    : null;
  const previewRatio = prepared && prepared.width && prepared.height
    ? Math.min(Math.max(prepared.width / prepared.height, 0.56), 1.9)
    : 1;
  const canSubmit = !!prepared && agreed && !uploading && !preparing;

  // ----- Form -----
  return (
    <KeyboardAvoidingView
      style={[styles.screen, darkMode && styles.screenDark]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={20}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        {backButton}
        <Text style={[styles.title, t(22), light]}>Add a {word}</Text>

        {/* File */}
        {previewUri ? (
          <View style={[styles.box, darkMode && styles.boxDark]}>
            <View>
              <Image
                source={{ uri: previewUri }}
                style={[styles.preview, { aspectRatio: previewRatio }]}
                resizeMode="contain"
              />
              {prepared?.type === "video" && (
                <View style={styles.videoBadge}>
                  <MaterialIcons name="videocam" size={16} color="#fff" />
                  <Text style={styles.videoBadgeText}>
                    {Math.max(1, Math.round(prepared.seconds))} s
                  </Text>
                </View>
              )}
            </View>
            <Pressable
              style={[styles.changeButton, darkMode && styles.boxDark]}
              onPress={() => choose("library")}
              disabled={uploading || preparing}
            >
              <Text style={[styles.changeButtonText, t(14)]}>
                Choose a different {word}
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={[styles.box, darkMode && styles.boxDark]}>
            <Text style={[styles.bodyText, t(15), muted]}>
              {type === "meme"
                ? "Choose a picture from your phone."
                : `Choose a video from your phone (up to ${MAX_VIDEO_SECONDS} seconds).`}
            </Text>
            <Pressable
              style={[styles.primaryButton, styles.pickButton]}
              onPress={() => choose("library")}
              disabled={preparing}
            >
              <MaterialIcons name="photo-library" size={22} color="#fff" />
              <Text style={[styles.primaryButtonText, t(16)]}>Choose from phone</Text>
            </Pressable>
            {type === "meme" && (
              <Pressable
                style={[styles.secondaryButton, styles.pickButton, darkMode && styles.boxDark]}
                onPress={() => choose("camera")}
                disabled={preparing}
              >
                <MaterialIcons name="photo-camera" size={22} color={darkMode ? "#f3f3f3" : "#111"} />
                <Text style={[styles.secondaryButtonText, t(15), light]}>Take a photo</Text>
              </Pressable>
            )}
          </View>
        )}

        {preparing && (
          <View style={styles.busyRow}>
            <ActivityIndicator />
            <Text style={[styles.busyText, t(14), muted]}>
              {prepProgress === null
                ? `Preparing your ${word}…`
                : `Shrinking your video… ${Math.round(prepProgress * 100)}% (please keep the app open)`}
            </Text>
          </View>
        )}

        {/* Language */}
        <Text style={[styles.label, t(13), muted]}>Language</Text>
        <Pressable
          style={[styles.input, styles.languageButton, darkMode && styles.inputDark]}
          onPress={() => setLanguageOpen(true)}
          disabled={uploading}
        >
          <Text style={[styles.inputText, t(15), light]}>{language}</Text>
          <MaterialIcons name="expand-more" size={22} color={darkMode ? "#bdbdbd" : "#777"} />
        </Pressable>

        {/* Description */}
        <Text style={[styles.label, t(13), muted]}>
          Description (optional) {description.length}/{MAX_DESCRIPTION}
        </Text>
        <TextInput
          style={[styles.input, styles.inputText, t(15), darkMode && styles.inputDark, light]}
          value={description}
          onChangeText={(text) => setDescription(text.replace(/\n/g, " "))}
          maxLength={MAX_DESCRIPTION}
          placeholder={type === "meme" ? "Say something about your meme" : "Say something about your video"}
          placeholderTextColor={darkMode ? "#888" : "#999"}
          editable={!uploading}
          returnKeyType="done"
          blurOnSubmit
        />

        {/* Agreement */}
        <Pressable style={styles.agreeRow} onPress={() => setAgreed((v) => !v)} disabled={uploading}>
          <MaterialIcons
            name={agreed ? "check-box" : "check-box-outline-blank"}
            size={26}
            color={agreed ? "#1877f2" : darkMode ? "#bdbdbd" : "#777"}
          />
          <Text style={[styles.agreeText, t(14), light]}>
            I made this {word} or have permission to share it, and it follows the{" "}
            <Text style={styles.linkText} onPress={() => router.push("/guidelines")}>
              Community Guidelines
            </Text>
            .
          </Text>
        </Pressable>

        <Text style={[styles.note, t(13), muted]}>
          Every upload is checked by our team before it appears in the app. This is done by hand,
          so it may take a little while.
        </Text>

        {errorText && (
          <View style={styles.errorBox}>
            <Text style={[styles.errorText, t(14)]}>{errorText}</Text>
          </View>
        )}

        <Pressable
          style={[styles.primaryButton, !canSubmit && styles.buttonDisabled]}
          onPress={submit}
          disabled={!canSubmit}
        >
          {uploading ? (
            <View style={styles.busyInline}>
              <ActivityIndicator color="#fff" />
              <Text style={[styles.primaryButtonText, t(16)]}>Uploading…</Text>
            </View>
          ) : (
            <Text style={[styles.primaryButtonText, t(16)]}>Submit {word}</Text>
          )}
        </Pressable>
        {uploading && (
          <Text style={[styles.note, t(13), muted]}>Please keep the app open until it finishes.</Text>
        )}
      </ScrollView>

      {languageOpen && (
        <View style={styles.overlay}>
          <View style={[styles.languageBox, darkMode && styles.boxDark]}>
            <Text style={[styles.languageTitle, t(16), light]}>Language</Text>
            <FlatList
              data={LANGUAGE_OPTIONS}
              keyExtractor={(item) => item}
              style={styles.languageList}
              renderItem={({ item }) => (
                <Pressable
                  style={styles.languageItem}
                  onPress={() => {
                    setLanguage(item);
                    setLanguageOpen(false);
                  }}
                >
                  <Text
                    style={[
                      styles.languageItemText,
                      t(16),
                      darkMode ? styles.textMuted : null,
                      item === language && styles.languageItemSelected,
                      item === language && darkMode && styles.textLight,
                    ]}
                  >
                    {item}
                  </Text>
                </Pressable>
              )}
            />
            <Pressable style={styles.primaryButton} onPress={() => setLanguageOpen(false)}>
              <Text style={[styles.primaryButtonText, t(15)]}>Close</Text>
            </Pressable>
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#efefef" },
  screenDark: { backgroundColor: "#101010" },
  content: { padding: 16, paddingBottom: 40 },
  textLight: { color: "#f3f3f3" },
  textMuted: { color: "#bdbdbd" },
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
  backButtonText: { color: "#111", fontWeight: "600" },
  title: { fontWeight: "700", color: "#111", marginBottom: 14 },
  box: {
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 14,
    marginBottom: 12,
  },
  boxDark: { backgroundColor: "#1b1b1b", borderColor: "#333" },
  bodyText: { color: "#333", lineHeight: 22, marginBottom: 12 },
  preview: { width: "100%", borderRadius: 10, backgroundColor: "#000" },
  videoBadge: {
    position: "absolute",
    left: 8,
    bottom: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  videoBadgeText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  changeButton: {
    marginTop: 10,
    alignSelf: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  changeButtonText: { color: "#1877f2", fontWeight: "600" },
  pickButton: { flexDirection: "row", gap: 8, marginTop: 0, marginBottom: 10 },
  busyRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  busyText: { color: "#555" },
  busyInline: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { color: "#555", marginTop: 6, marginBottom: 6 },
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
  },
  inputDark: { backgroundColor: "#1b1b1b", borderColor: "#333" },
  inputText: { color: "#111" },
  languageButton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  agreeRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, marginTop: 10, marginBottom: 10 },
  agreeText: { flex: 1, color: "#111", lineHeight: 20 },
  linkText: { color: "#1877f2", textDecorationLine: "underline" },
  note: { color: "#666", lineHeight: 19, marginBottom: 12, textAlign: "center" },
  errorBox: {
    backgroundColor: "#fdecea",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: "#c62828", fontWeight: "600" },
  primaryButton: {
    backgroundColor: "#1877f2",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
    marginBottom: 10,
  },
  primaryButtonText: { color: "#fff", fontWeight: "700" },
  buttonDisabled: { opacity: 0.45 },
  secondaryButton: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  secondaryButtonText: { color: "#111", fontWeight: "600" },
  doneBox: { alignItems: "center", paddingVertical: 24 },
  doneTitle: { fontWeight: "700", color: "#111", marginTop: 8, marginBottom: 8 },
  doneText: { color: "#444", textAlign: "center", lineHeight: 22 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  languageBox: {
    width: "100%",
    maxWidth: 380,
    maxHeight: "80%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
  },
  languageTitle: { fontWeight: "700", color: "#111", marginBottom: 8, textAlign: "center" },
  languageList: { marginBottom: 10 },
  languageItem: { height: 46, justifyContent: "center", alignItems: "center" },
  languageItemText: { color: "#777" },
  languageItemSelected: { color: "#111", fontWeight: "700" },
});
