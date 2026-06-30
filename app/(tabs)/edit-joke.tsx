import { useIsFocused } from "@react-navigation/native";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
    Alert,
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "../../lib/supabase";

/*
=========================================================
Constants
=========================================================
*/

const SPAM_KEY = "donkey:last-submit:v1";
const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";

const LANGUAGE_OPTIONS = [
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

const MIN_SUBMIT_TIME = 1500;

/*
=========================================================
Edit Joke Screen
=========================================================
*/

export default function EditJokeScreen() {
  const params = useLocalSearchParams<{ jokeId?: string }>();

  /*
  -------------------------------------------------------
  Form state
  -------------------------------------------------------
  */

  const [jokeText, setJokeText] = useState("");
  const [language, setLanguage] = useState<string>("English");
  const [languageDraft, setLanguageDraft] = useState<string>("English");
  const [previewMode, setPreviewMode] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingJokeId, setEditingJokeId] = useState<string | null>(null);
  const [loadingExistingJoke, setLoadingExistingJoke] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [languageModalOpen, setLanguageModalOpen] = useState(false);

  /*
  -------------------------------------------------------
  Appearance state
  -------------------------------------------------------
  */

  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");

  /*
  -------------------------------------------------------
  Auth state
  -------------------------------------------------------
  */

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  /*
  -------------------------------------------------------
  Confirmation state
  -------------------------------------------------------
  */

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [confirmMessage, setConfirmMessage] = useState("");
  const [confirmType, setConfirmType] = useState<"yesNo" | "submit">("yesNo");
  const confirmActionRef = useRef<null | (() => void | Promise<void>)>(null);

  /*
  -------------------------------------------------------
  Screen helpers
  -------------------------------------------------------
  */

  const openTimeRef = useRef(Date.now());
  const languageScrollRef = useRef<FlatList<string> | null>(null);
  const isFocused = useIsFocused();

  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;

  /*
  =======================================================
  INITIAL LOAD
  =======================================================
  */

  useEffect(() => {
    if (!isFocused) return;

    const start = async () => {
      openTimeRef.current = Date.now();

      setPreviewMode(false);
      setSubmitSuccess(false);
      setConfirmVisible(false);
      setLanguageModalOpen(false);
      setErrorText(null);
      setLoadingExistingJoke(true);

      await loadAppearanceSettings();
      const userId = await loadUser();

      const jokeId =
        typeof params.jokeId === "string" ? params.jokeId : null;

      if (!userId) {
        setErrorText("Please sign in to edit your jokes.");
        setLoadingExistingJoke(false);
        return;
      }

      if (!jokeId) {
        setErrorText("No joke selected for editing.");
        setLoadingExistingJoke(false);
        return;
      }

      await loadJokeForEdit(jokeId, userId);
    };

    start();
  }, [isFocused, params.jokeId]);

  /*
  -------------------------------------------------------
  Load logged in user
  -------------------------------------------------------
  */

  const loadUser = async () => {
    const { data } = await supabase.auth.getUser();
    const user = data.user;

    setCurrentUserId(user?.id ?? null);

    if (user?.id) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .maybeSingle();

      if (profile?.display_name) {
        setDisplayName(profile.display_name);
      } else {
        setDisplayName(null);
      }
    } else {
      setDisplayName(null);
    }

    return user?.id ?? null;
  };

  /*
  -------------------------------------------------------
  Load appearance settings
  -------------------------------------------------------
  */

  const loadAppearanceSettings = async () => {
    try {
      const rawDark = await AsyncStorage.getItem(DARK_MODE_KEY);
      const rawText = await AsyncStorage.getItem(TEXT_SIZE_KEY);

      setDarkMode(rawDark === "true");

      if (rawText === "Small" || rawText === "Normal" || rawText === "Large") {
        setTextSize(rawText);
      } else {
        setTextSize("Normal");
      }
    } catch {
      setDarkMode(false);
      setTextSize("Normal");
    }
  };

  /*
  -------------------------------------------------------
  Load joke being edited
  -------------------------------------------------------
  */

  const loadJokeForEdit = async (jokeId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from("jokes")
        .select("id, content, language")
        .eq("id", jokeId)
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setErrorText("This joke could not be loaded for editing.");
        return;
      }

      setEditingJokeId(data.id);
      setJokeText(data.content ?? "");
      setLanguage(data.language ?? "English");
      setLanguageDraft(data.language ?? "English");
    } catch (e: any) {
      setErrorText(e.message || "Failed to load joke for editing.");
    } finally {
      setLoadingExistingJoke(false);
    }
  };

  /*
  =======================================================
  HELPERS
  =======================================================
  */

  const resetEditMemory = () => {
    setEditingJokeId(null);
    setJokeText("");
    setLanguage("English");
    setLanguageDraft("English");
    setPreviewMode(false);
    setSubmitSuccess(false);
    setConfirmVisible(false);
    setConfirmMessage("");
    setLanguageModalOpen(false);
  };

  const openConfirm = (
    message: string,
    onConfirm: () => void | Promise<void>,
    type: "yesNo" | "submit" = "yesNo"
  ) => {
    setConfirmMessage(message);
    setConfirmType(type);
    confirmActionRef.current = onConfirm;
    setConfirmVisible(true);
  };

  const goToMyJokesClean = () => {
    resetEditMemory();
    router.replace("/(tabs)/my-jokes");
  };

  /*
  =======================================================
  BUTTON ACTIONS
  =======================================================
  */

  const handleCancelFromPageOne = () => {
    openConfirm("Are you sure you want to cancel editing?", () => {
      goToMyJokesClean();
    });
  };

  const handleDiscardFromPreview = () => {
    openConfirm("Are you sure you want to discard these edits?", () => {
      goToMyJokesClean();
    });
  };

  const handleSubmitConfirm = () => {
    openConfirm(
      "By submitting this edit you agree with the Terms & Conditions and Community Guidelines.",
      submitJokeEdit,
      "submit"
    );
  };

  /*
  =======================================================
  SPAM PROTECTION
  =======================================================
  */

  const checkSpamDelay = async () => {
    try {
      const raw = await AsyncStorage.getItem(SPAM_KEY);
      if (!raw) return true;

      const last = Number(raw);
      const now = Date.now();

      if (now - last < 10000) {
        Alert.alert(
          "Please wait",
          "Please wait a few seconds before submitting another change."
        );
        return false;
      }

      return true;
    } catch {
      return true;
    }
  };

  const checkBotSpeed = () => {
    const elapsed = Date.now() - openTimeRef.current;

    if (elapsed < MIN_SUBMIT_TIME) {
      Alert.alert(
        "Please wait",
        "Please take a moment to review your joke before submitting."
      );
      return false;
    }

    return true;
  };

  /*
  =======================================================
  SUBMIT EDIT
  =======================================================
  */

  const submitJokeEdit = async () => {
    if (!jokeText.trim()) {
      Alert.alert("Empty joke", "Please write a joke first.");
      return;
    }

    if (!editingJokeId || !currentUserId) {
      Alert.alert("Error", "This joke could not be edited.");
      return;
    }

    if (busy) return;

    const allowedDelay = await checkSpamDelay();
    if (!allowedDelay) return;

    const allowedSpeed = checkBotSpeed();
    if (!allowedSpeed) return;

    try {
      setBusy(true);

      const { data, error } = await supabase
        .from("jokes")
        .update({
          content: jokeText.trim(),
          language: language,
          is_new: true,
          is_visible: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingJokeId)
        .eq("user_id", currentUserId)
        .select("id")
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        throw new Error("This joke could not be updated.");
      }

      await AsyncStorage.setItem(SPAM_KEY, String(Date.now()));

      setPreviewMode(false);
      setSubmitSuccess(true);
      setJokeText("");
      setEditingJokeId(null);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to update joke.");
    } finally {
      setBusy(false);
    }
  };

  /*
  =======================================================
  CONFIRMATION BOX
  =======================================================
  */

  const renderConfirmBox = () => {
    if (!confirmVisible) return null;

    return (
      <View style={styles.confirmOverlay}>
        <View style={[styles.confirmBox, darkMode && styles.confirmBoxDark]}>
          <Text
            style={[
              styles.confirmTitle,
              { fontSize: 16 * textScale },
              darkMode && styles.confirmTitleDark,
            ]}
          >
            {confirmMessage}
          </Text>

          <View style={styles.confirmButtons}>
            {confirmType === "submit" ? (
              <>
                <Pressable
                  style={[styles.cancelButtonSolid, { flex: 1 }]}
                  onPress={() => setConfirmVisible(false)}
                >
                  <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
                    Go Back
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.submitButton, { flex: 1 }]}
                  onPress={() => {
                    const action = confirmActionRef.current;
                    setConfirmVisible(false);
                    action?.();
                  }}
                >
                  <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
                    Submit
                  </Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  style={[styles.submitButton, { flex: 1 }]}
                  onPress={() => setConfirmVisible(false)}
                >
                  <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
                    No
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.cancelButtonSolid, { flex: 1 }]}
                  onPress={() => {
                    const action = confirmActionRef.current;
                    setConfirmVisible(false);
                    action?.();
                  }}
                >
                  <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
                    Yes
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    );
  };

  /*
  =======================================================
  SUCCESS SCREEN
  =======================================================
  */

  if (submitSuccess) {
    return (
      <View style={[styles.successScreen, darkMode && styles.successScreenDark]}>
        <Text
          style={[
            styles.successTitle,
            { fontSize: 22 * textScale },
            darkMode && styles.successTitleDark,
          ]}
        >
          Joke updated
        </Text>

        <Text
          style={[
            styles.successMessage,
            { fontSize: 15 * textScale, lineHeight: 22 * textScale },
            darkMode && styles.successMessageDark,
          ]}
        >
          Your edited joke is now pending review, which should be done within the next 24 hours.
        </Text>

        <View style={styles.successButtons}>
          <Pressable
            style={styles.successButton}
            onPress={() => {
              resetEditMemory();
              router.replace("/(tabs)/my-jokes");
            }}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Go to My Jokes
            </Text>
          </Pressable>

          <Pressable
            style={styles.successButton}
            onPress={() => {
              resetEditMemory();
              router.replace("/(tabs)");
            }}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Home screen
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  /*
  =======================================================
  LOADING / ERROR SCREEN
  =======================================================
  */

  if (loadingExistingJoke) {
    return (
      <View style={[styles.successScreen, darkMode && styles.successScreenDark]}>
        <Text
          style={[
            styles.successMessage,
            { fontSize: 15 * textScale, lineHeight: 22 * textScale },
            darkMode && styles.successMessageDark,
          ]}
        >
          Loading joke for editing...
        </Text>
      </View>
    );
  }

  if (errorText) {
    return (
      <View style={[styles.successScreen, darkMode && styles.successScreenDark]}>
        <Text
          style={[
            styles.successTitle,
            { fontSize: 22 * textScale },
            darkMode && styles.successTitleDark,
          ]}
        >
          Edit Joke
        </Text>

        <Text
          style={[
            styles.successMessage,
            { fontSize: 15 * textScale, lineHeight: 22 * textScale },
            darkMode && styles.successMessageDark,
          ]}
        >
          {errorText}
        </Text>

        <Pressable
          style={styles.successButton}
          onPress={() => {
            resetEditMemory();
            router.replace("/(tabs)/my-jokes");
          }}
        >
          <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
            Go to My Jokes
          </Text>
        </Pressable>
      </View>
    );
  }

  /*
  =======================================================
  PREVIEW SCREEN
  =======================================================
  */

  if (previewMode) {
    return (
      <ScrollView
        style={[styles.screen, darkMode && styles.screenDark]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        showsVerticalScrollIndicator={false}
      >
        <Text
          style={[
            styles.title,
            { fontSize: 22 * textScale },
            darkMode && styles.titleDark,
          ]}
        >
          Preview Edit
        </Text>

        <View
          style={[
            styles.previewCard,
            darkMode && styles.previewCardDark,
          ]}
        >
          <Text
            style={[
              styles.previewMeta,
              { fontSize: 12 * textScale },
              darkMode && styles.previewMetaDark,
            ]}
          >
            {displayName ? displayName : "You"} • {language}
          </Text>

          <Text
            style={[
              styles.previewText,
              { fontSize: 16 * textScale, lineHeight: 22 * textScale },
              darkMode && styles.previewTextDark,
            ]}
          >
            {jokeText}
          </Text>
        </View>

        <Text
          style={[
            styles.instructions,
            { fontSize: 14 * textScale, lineHeight: 21 * textScale },
            darkMode && styles.instructionsDark,
          ]}
        >
          By submitting this edit you agree to our{" "}
          <Text
            style={styles.linkText}
            onPress={() => router.push("/terms")}
          >
            Terms & Conditions
          </Text>
          ,{" "}
          <Text
            style={styles.linkText}
            onPress={() => router.push("/guidelines")}
          >
            Community Guidelines
          </Text>
          {" "}and{" "}
          <Text
            style={styles.linkText}
            onPress={() => router.push("/privacy")}
          >
            Privacy Policy
          </Text>
          .
        </Text>

        <View style={styles.previewButtonStack}>
          <Pressable
            style={styles.previewButton}
            onPress={() => setPreviewMode(false)}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Edit
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancelButtonSolid}
            onPress={handleDiscardFromPreview}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Discard
            </Text>
          </Pressable>

          <Pressable
            style={styles.submitButton}
            onPress={handleSubmitConfirm}
            disabled={busy}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              {busy ? "Submitting..." : "Submit Edit"}
            </Text>
          </Pressable>
        </View>

        {renderConfirmBox()}
      </ScrollView>
    );
  }

  /*
  =======================================================
  EDIT JOKE SCREEN
  =======================================================
  */

  return (
    <KeyboardAvoidingView
      style={[styles.screen, darkMode && styles.screenDark]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={20}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="always"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.logoOnlyTop}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        </View>

        <Text
          style={[
            styles.title,
            { fontSize: 22 * textScale },
            darkMode && styles.titleDark,
          ]}
        >
          Edit Joke
        </Text>

        <Text
          style={[
            styles.editWarning,
            { fontSize: 13 * textScale, lineHeight: 19 * textScale },
          ]}
        >
          Editing this joke will send it back for review before it becomes visible again.
        </Text>

        <Text
          style={[
            styles.languageLabel,
            { fontSize: 13 * textScale },
            darkMode && styles.languageLabelDark,
          ]}
        >
          Joke language
        </Text>

        <View
          style={[
            styles.languageBox,
            darkMode && styles.languageBoxDark,
          ]}
        >
          <Pressable
            style={[
              styles.languageSelectorButton,
              darkMode && styles.languageSelectorButtonDark,
            ]}
            onPress={() => {
              setLanguageDraft(language);
              setLanguageModalOpen(true);

              setTimeout(() => {
                const currentIndex = LANGUAGE_OPTIONS.indexOf(language);

                if (currentIndex >= 0) {
                  languageScrollRef.current?.scrollToIndex({
                    index: currentIndex,
                    animated: false,
                    viewPosition: 0.5,
                  });
                }
              }, 50);
            }}
          >
            <Text
              style={[
                styles.languageSelectorText,
                darkMode && styles.languageSelectorTextDark,
              ]}
            >
              {language}
            </Text>
          </Pressable>
        </View>

        <TextInput
          style={[
            styles.input,
            {
              fontSize: 16 * textScale,
              lineHeight: 22 * textScale,
            },
            darkMode && styles.inputDark,
          ]}
          multiline
          placeholder="Edit your joke here..."
          placeholderTextColor={darkMode ? "#999" : "#888"}
          value={jokeText}
          onChangeText={setJokeText}
          maxLength={5000}
          autoFocus
        />

        <Text
          style={[
            styles.counter,
            { fontSize: 12 * textScale },
            darkMode && styles.counterDark,
          ]}
        >
          {jokeText.length} / 5000
        </Text>

        <View style={styles.buttonRow}>
          <Pressable
            style={[styles.cancelButtonSolid, { flex: 1 }]}
            onPress={handleCancelFromPageOne}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Cancel
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.previewButton,
              { flex: 1 },
              !jokeText.trim() && styles.previewButtonDisabled,
            ]}
            disabled={!jokeText.trim()}
            onPress={() => setPreviewMode(true)}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Preview
            </Text>
          </Pressable>
        </View>

        {languageModalOpen && (
          <View style={styles.confirmOverlay}>
            <View style={[styles.confirmBox, darkMode && styles.confirmBoxDark]}>
              <Text
                style={[
                  styles.confirmTitle,
                  { fontSize: 16 * textScale },
                  darkMode && styles.confirmTitleDark,
                ]}
              >
                Joke language
              </Text>

              <View style={styles.languagePickerContainer}>
                <FlatList
                  ref={languageScrollRef}
                  data={LANGUAGE_OPTIONS}
                  keyExtractor={(item) => item}
                  showsVerticalScrollIndicator={false}
                  renderItem={({ item }: { item: string }) => (
                    <Pressable
                      style={styles.languageItemButton}
                      onPress={() => {
                        setLanguageDraft(item);
                      }}
                    >
                      <Text
                        style={[
                          styles.languageItemText,
                          languageDraft === item && {
                            fontSize: 18,
                            fontWeight: "600",
                            color: darkMode ? "#f3f3f3" : "#111",
                          },
                          languageDraft !== item && {
                            color: darkMode ? "#bdbdbd" : "#777",
                          },
                        ]}
                      >
                        {item}
                      </Text>
                    </Pressable>
                  )}
                  getItemLayout={(_, index) => ({
                    length: 48,
                    offset: 48 * index,
                    index,
                  })}
                />
              </View>

              <View style={styles.confirmButtons}>
                <Pressable
                  style={[styles.neutralButton, { flex: 1 }]}
                  onPress={() => setLanguageModalOpen(false)}
                >
                  <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={[styles.submitButton, { flex: 1 }]}
                  onPress={() => {
                    setLanguage(languageDraft);
                    setLanguageModalOpen(false);
                  }}
                >
                  <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
                    Save
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {renderConfirmBox()}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  screen: {
    flex: 1,
    backgroundColor: "#efefef",
    padding: 16,
  },

  screenDark: {
    backgroundColor: "#101010",
  },

  scrollContent: {
    paddingBottom: 24,
  },

  logoOnlyTop: {
    alignItems: "flex-end",
    marginBottom: 14,
  },

  logo: {
    width: 44,
    height: 44,
  },

  title: {
    fontWeight: "600",
    marginBottom: 12,
    color: "#111",
  },

  titleDark: {
    color: "#f3f3f3",
  },

  editWarning: {
    color: "#b26a00",
    marginBottom: 12,
  },

  languageLabel: {
    color: "#666",
    marginBottom: 6,
  },

  languageLabelDark: {
    color: "#bdbdbd",
  },

  languageBox: {
    marginBottom: 14,
  },

  languageBoxDark: {},

  languageSelectorButton: {
    height: 50,
    justifyContent: "center",
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#ddd",
  },

  languageSelectorButtonDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  languageSelectorText: {
    fontSize: 15,
    color: "#111",
    textAlign: "center",
  },

  languageSelectorTextDark: {
    color: "#f3f3f3",
  },

  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 12,
    height: 220,
    textAlignVertical: "top",
    color: "#111",
  },

  inputDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
    color: "#f3f3f3",
  },

  counter: {
    textAlign: "right",
    color: "#777",
    marginTop: 4,
  },

  counterDark: {
    color: "#bdbdbd",
  },

  previewCard: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    marginBottom: 16,
  },

  previewCardDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  previewMeta: {
    color: "#777",
    marginBottom: 6,
  },

  previewMetaDark: {
    color: "#bdbdbd",
  },

  previewText: {
    color: "#111",
  },

  previewTextDark: {
    color: "#f3f3f3",
  },

  instructions: {
    color: "#555",
    marginBottom: 18,
  },

  instructionsDark: {
    color: "#c7c7c7",
  },

  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 20,
  },

  previewButtonStack: {
    gap: 12,
  },

  cancelButtonSolid: {
    backgroundColor: "#c62828",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  neutralButton: {
    backgroundColor: "#757575",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  previewButton: {
    backgroundColor: "#2f71d3",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  previewButtonDisabled: {
    backgroundColor: "#9bb6e6",
  },

  submitButton: {
    backgroundColor: "#2e7d32",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  buttonTextWhite: {
    color: "#fff",
    fontWeight: "600",
  },

  successScreen: {
    flex: 1,
    backgroundColor: "#efefef",
    padding: 16,
    justifyContent: "center",
    alignItems: "center",
  },

  successScreenDark: {
    backgroundColor: "#101010",
  },

  successTitle: {
    fontWeight: "600",
    marginBottom: 12,
    textAlign: "center",
    color: "#111",
  },

  successTitleDark: {
    color: "#f3f3f3",
  },

  successMessage: {
    color: "#555",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },

  successMessageDark: {
    color: "#c7c7c7",
  },

  successButtons: {
    width: "100%",
    gap: 12,
  },

  successButton: {
    backgroundColor: "#2f71d3",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    width: "100%",
  },

  confirmOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
  },

  confirmBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 14,
    width: 300,
    maxHeight: 420,
  },

  confirmBoxDark: {
    backgroundColor: "#1b1b1b",
  },

  confirmTitle: {
    marginBottom: 16,
    fontWeight: "600",
    color: "#111",
    textAlign: "center",
  },

  confirmTitleDark: {
    color: "#f3f3f3",
  },

  confirmButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },

  languagePickerContainer: {
    height: 180,
    marginBottom: 14,
  },

  languageItemButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  languageItemText: {
    fontSize: 16,
  },

  linkText: {
    color: "#2f71d3",
    textDecorationLine: "underline",
    fontWeight: "600",
  },
});