import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import * as Application from "expo-application";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  DeviceEventEmitter,
  FlatList,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { useVideoSoundSetting } from "../../lib/video";

// ------------------------------
// Types
// ------------------------------
type TextSizeOption = "Small" | "Normal" | "Large";
type JokeLanguageOption =
  | "English"
  | "Polski"
  | "Deutsch"
  | "Français"
  | "Español"
  | "Italiano"
  | "Nederlands"
  | "Português"
  | "Svenska"
  | "Dansk"
  | "Suomi"
  | "Norsk"
  | "Čeština"
  | "Slovenčina"
  | "Magyar"
  | "Română"
  | "Hrvatski"
  | "Slovenščina"
  | "Eesti"
  | "Latviešu";

// ------------------------------
// Storage keys
// ------------------------------
const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";
const LANGUAGE_KEY = "donkey:language:v1";
const LANGUAGE_OPTIONS: JokeLanguageOption[] = [
  "English",
  "Polski",
  "Deutsch",
  "Français",
  "Español",
  "Italiano",
  "Nederlands",
  "Português",
  "Svenska",
  "Dansk",
  "Suomi",
  "Norsk",
  "Čeština",
  "Slovenčina",
  "Magyar",
  "Română",
  "Hrvatski",
  "Slovenščina",
  "Eesti",
  "Latviešu",
];

export default function SettingsScreen() {
  // ------------------------------
  // Main settings state
  // ------------------------------
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<TextSizeOption>("Normal");
  const [jokeLanguage, setJokeLanguage] =
    useState<JokeLanguageOption>("English");

  // ------------------------------
  // Modal state
  // ------------------------------
  const [textSizeModalOpen, setTextSizeModalOpen] = useState(false);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  // ------------------------------
  // User state
  // ------------------------------

  // ------------------------------
  // Draft state for modals
  // ------------------------------
  const [textSizeDraft, setTextSizeDraft] =
    useState<TextSizeOption>("Normal");
  const languageScrollRef = useRef<ScrollView | null>(null);  
  const [jokeLanguageDraft, setJokeLanguageDraft] =
    useState<JokeLanguageOption>("English");
  const isFocused = useIsFocused();

  // Phone-only video sound preference (never stored in Supabase).
  const [videoSoundOn, setVideoSoundOn] = useVideoSoundSetting();

  // ------------------------------
  // Load saved settings + profile
  // ------------------------------
useEffect(() => {
  (async () => {
    try {
      const rawLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
      if (rawLanguage) {
        const savedLanguage = rawLanguage as JokeLanguageOption;
        setJokeLanguage(savedLanguage);
        setJokeLanguageDraft(savedLanguage);
      }

      const rawDark = await AsyncStorage.getItem(DARK_MODE_KEY);
      if (rawDark) {
        setDarkMode(rawDark === "true");
      }

      const rawText = await AsyncStorage.getItem(TEXT_SIZE_KEY);
      if (rawText) {
        const savedText = rawText as TextSizeOption;
        setTextSize(savedText);
        setTextSizeDraft(savedText);
      }
    } catch (e) {
      console.log("Failed to load saved settings:", e);
    }

  })();
}, [isFocused]);

  // ------------------------------
  // Modal open helpers
  // ------------------------------
  const openTextSizeModal = () => {
    setTextSizeDraft(textSize);
    setTextSizeModalOpen(true);
  };

  const openLanguageModal = () => {
    setJokeLanguageDraft(jokeLanguage);
    setLanguageModalOpen(true);

    setTimeout(() => {
      const currentIndex = LANGUAGE_OPTIONS.indexOf(jokeLanguage);

      if (currentIndex >= 0) {
        languageScrollRef.current?.scrollTo({
          y: currentIndex * 44,
          animated: false,
        });
      }
    }, 50);
  };

  // ------------------------------
  // Reusable dark mode styles
  // ------------------------------
  const darkRowStyle = darkMode
    ? { backgroundColor: "#1b1b1b", borderColor: "#333" }
    : null;

  const darkLabelStyle = darkMode ? { color: "#f3f3f3" } : null;
  const darkValueStyle = darkMode ? { color: "#bdbdbd" } : null;
  const darkSectionStyle = darkMode ? { color: "#bdbdbd" } : null;

  return (
    <ScrollView
      style={[styles.container, darkMode && { backgroundColor: "#101010" }]}
      contentContainerStyle={{ paddingBottom: 20 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Top bar */}
      <View style={styles.topBar}>
        <Pressable
          style={[
            styles.backButton,
            darkMode && {
              backgroundColor: "#1b1b1b",
              borderColor: "#333",
            },
          ]}
          onPress={() => router.back()}
        >
          <Text
            style={[
              styles.backButtonText,
              darkMode && { color: "#f3f3f3" },
            ]}
          >
            ← Back to jokes
          </Text>
        </Pressable>

        <Image
          source={require("../../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
      </View>

      {/* Content */}
      <Text style={[styles.section, darkSectionStyle]}>Content</Text>

      <Pressable
        style={[styles.row, darkRowStyle]}
        onPress={openLanguageModal}
      >
        <Text style={[styles.label, darkLabelStyle]}>Joke language</Text>
        <Text style={[styles.value, darkValueStyle]}>{jokeLanguage}</Text>
      </Pressable>

      <View style={[styles.row, darkRowStyle]}>
        <Text style={[styles.label, darkLabelStyle]}>Video sound</Text>
        <Switch
          value={videoSoundOn}
          onValueChange={(value) => setVideoSoundOn(value)}
          trackColor={{ false: "#9a9a9a", true: "#2f71d3" }}
          thumbColor={videoSoundOn ? "#ffffff" : "#2f71d3"}
          ios_backgroundColor="#9a9a9a"
        />
      </View>

      {/* Appearance */}
      <Text style={[styles.section, darkSectionStyle]}>Appearance</Text>

      <View style={[styles.row, darkRowStyle]}>
        <Text style={[styles.label, darkLabelStyle]}>Dark mode</Text>
<Switch
  value={darkMode}
  onValueChange={async (value) => {
    setDarkMode(value);
    await AsyncStorage.setItem(DARK_MODE_KEY, String(value));
    DeviceEventEmitter.emit("darkModeChanged", value);
  }}
  trackColor={{ false: "#9a9a9a", true: "#2f71d3" }}
  thumbColor={darkMode ? "#ffffff" : "#2f71d3"}
  ios_backgroundColor="#9a9a9a"
/>
      </View>

      <Pressable
        style={[styles.row, darkRowStyle]}
        onPress={openTextSizeModal}
      >
        <Text style={[styles.label, darkLabelStyle]}>Text size</Text>
        <Text style={[styles.value, darkValueStyle]}>{textSize}</Text>
      </Pressable>

      {/* App */}
      <Text style={[styles.section, darkSectionStyle]}>App</Text>

      <Pressable
        style={[styles.row, darkRowStyle]}
        onPress={() => router.push("/privacy")}
      >
        <Text style={[styles.label, darkLabelStyle]}>Privacy Policy</Text>
        <MaterialIcons
          name="chevron-right"
          size={20}
          color={darkMode ? "#bdbdbd" : "#666"}
        />
      </Pressable>

      <Pressable
        style={[styles.row, darkRowStyle]}
        onPress={() => router.push("/terms")}
      >
        <Text style={[styles.label, darkLabelStyle]}>Terms & Conditions</Text>
        <MaterialIcons
          name="chevron-right"
          size={20}
          color={darkMode ? "#bdbdbd" : "#666"}
        />
      </Pressable>

      <Pressable
        style={[styles.row, darkRowStyle]}
        onPress={() => router.push("/guidelines")}
      >
        <Text style={[styles.label, darkLabelStyle]}>
          Community Guidelines
        </Text>
        <MaterialIcons
          name="chevron-right"
          size={20}
          color={darkMode ? "#bdbdbd" : "#666"}
        />
      </Pressable>

      <Pressable
        style={[styles.row, darkRowStyle]}
        onPress={() => router.push("/contact-us")}
      >
        <Text style={[styles.label, darkLabelStyle]}>Contact Us</Text>
        <MaterialIcons
          name="chevron-right"
          size={20}
          color={darkMode ? "#bdbdbd" : "#666"}
        />
      </Pressable>

      <View style={[styles.row, darkRowStyle]}>
        <Text style={[styles.label, darkLabelStyle]}>Version</Text>
        <Text style={[styles.value, darkValueStyle]}>
          {Application.nativeApplicationVersion ?? "?"} ({Application.nativeBuildVersion ?? "?"})
        </Text>
      </View>

      {/* Text size modal */}
      <Modal visible={textSizeModalOpen} transparent animationType="fade">
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setTextSizeModalOpen(false)}
        >
          <Pressable
            style={[
              styles.modalSheet,
              darkMode && {
                backgroundColor: "#1b1b1b",
                borderColor: "#333",
              },
            ]}
            onPress={() => {}}
          >
            <Text
              style={[
                styles.modalTitle,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              Text size
            </Text>

            <Pressable
              style={styles.modalOption}
              onPress={() => setTextSizeDraft("Small")}
            >
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                Small
              </Text>
              {textSizeDraft === "Small" && (
                <MaterialIcons name="check" size={20} color="#2f71d3" />
              )}
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => setTextSizeDraft("Normal")}
            >
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                Normal
              </Text>
              {textSizeDraft === "Normal" && (
                <MaterialIcons name="check" size={20} color="#2f71d3" />
              )}
            </Pressable>

            <Pressable
              style={styles.modalOption}
              onPress={() => setTextSizeDraft("Large")}
            >
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                Large
              </Text>
              {textSizeDraft === "Large" && (
                <MaterialIcons name="check" size={20} color="#2f71d3" />
              )}
            </Pressable>

            <View
              style={[
                styles.modalDivider,
                darkMode && { backgroundColor: "#333" },
              ]}
            />

            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[
                  styles.modalCancelButton,
                  darkMode && { backgroundColor: "#2a2a2a" },
                ]}
                onPress={() => setTextSizeModalOpen(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    darkMode && { color: "#f3f3f3" },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalSaveButton}
                onPress={async () => {
                  setTextSize(textSizeDraft);
                  await AsyncStorage.setItem(TEXT_SIZE_KEY, textSizeDraft);
                  setTextSizeModalOpen(false);
                }}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Language modal */}
<Modal visible={languageModalOpen} transparent animationType="fade">
  <View style={styles.modalOverlay}>
    <Pressable
      style={StyleSheet.absoluteFillObject}
      onPress={() => setLanguageModalOpen(false)}
    />

    <Pressable
      style={[
        styles.modalSheet,
        darkMode && {
          backgroundColor: "#1b1b1b",
          borderColor: "#333",
        },
      ]}
      onPress={() => {}}
    >
            <Text
              style={[
                styles.modalTitle,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              Joke language
            </Text>

<View style={styles.languagePickerContainer}>
  <FlatList
    data={LANGUAGE_OPTIONS}
    keyExtractor={(item) => item}
    showsVerticalScrollIndicator={false}
    renderItem={({ item }) => (
      <Pressable
        style={{
          paddingVertical: 14,
          alignItems: "center",
        }}
        onPress={() => {
          setJokeLanguageDraft(item);
        }}
      >
        <Text
          style={[
            { fontSize: 16 },
            jokeLanguageDraft === item && {
              fontSize: 18,
              fontWeight: "600",
              color: darkMode ? "#f3f3f3" : "#111",
            },
            jokeLanguageDraft !== item && {
              color: darkMode ? "#bdbdbd" : "#777",
            },
          ]}
        >
          {item}
        </Text>
      </Pressable>
    )}
  />
</View>

            <View
              style={[
                styles.modalDivider,
                darkMode && { backgroundColor: "#333" },
              ]}
            />

            <View style={styles.modalButtonsRow}>
              <Pressable
                style={[
                  styles.modalCancelButton,
                  darkMode && { backgroundColor: "#2a2a2a" },
                ]}
                onPress={() => setLanguageModalOpen(false)}
              >
                <Text
                  style={[
                    styles.modalCancelText,
                    darkMode && { color: "#f3f3f3" },
                  ]}
                >
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.modalSaveButton}
                onPress={async () => {
                  try {
                    setJokeLanguage(jokeLanguageDraft);
                    await AsyncStorage.setItem(
                      LANGUAGE_KEY,
                      jokeLanguageDraft
                    );
                    setLanguageModalOpen(false);
                  } catch (e) {
                    console.log("Failed to save language setting:", e);
                  }
                }}
              >
                <Text style={styles.modalSaveText}>Save</Text>
              </Pressable>
            </View>
    </Pressable>
  </View>
</Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  // Main page
  container: {
    flex: 1,
    backgroundColor: "#efefef",
    padding: 16,
  },

  // Top bar
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  backButton: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  backButtonText: {
    fontSize: 15,
    color: "#111",
    fontWeight: "600",
  },

  logo: {
    width: 44,
    height: 44,
  },

  // Section headings
  section: {
    fontSize: 14,
    fontWeight: "600",
    color: "#666",
    marginTop: 10,
    marginBottom: 8,
  },

  // Standard row
  row: {
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  // Delete account row


  // Row text
  label: {
    fontSize: 16,
    color: "#111",
  },

  value: {
    fontSize: 15,
    color: "#666",
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.30)",
    justifyContent: "flex-start",
    paddingTop: 60,
    paddingHorizontal: 12,
  },

  modalSheet: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  modalTitle: {
    fontSize: 16,
    marginBottom: 10,
    color: "#111",
    fontWeight: "600",
  },

  modalOption: {
    paddingVertical: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  modalDivider: {
    height: 2,
    backgroundColor: "#d9d9d9",
    marginTop: 8,
    marginBottom: 10,
  },

  modalButtonsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  modalCancelButton: {
    flex: 1,
    backgroundColor: "#eee",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 6,
  },

  modalSaveButton: {
    flex: 1,
    backgroundColor: "#2f71d3",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 6,
  },

  modalSaveButtonDisabled: {
    backgroundColor: "#9bb6e6",
  },

  modalItemText: {
    fontSize: 15,
    color: "#222",
  },

  modalCancelText: {
    color: "#333",
    fontWeight: "600",
  },

  modalSaveText: {
    color: "#fff",
    fontWeight: "600",
  },

  // Display name input


    languagePickerContainer: {
    height: 180,
    overflow: "hidden",
    marginBottom: 10,
  },

  languagePickerContent: {
    paddingVertical: 68,
  },

  languageItem: {
    height: 44,
    justifyContent: "center",
    alignItems: "center",
  },

  languageText: {
    fontSize: 16,
    color: "#777",
  },

  languageTextSelected: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },

  languageCenterHighlight: {
    position: "absolute",
    top: 68,
    left: 0,
    right: 0,
    height: 44,
    borderRadius: 8,
    backgroundColor: "rgba(47,113,211,0.10)",
  },
});