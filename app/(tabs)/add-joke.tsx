import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
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
const ADD_JOKE_LANGUAGE_KEY = "donkey:add-joke-language:v1";
const ADD_JOKE_DRAFT_KEY = "donkey:add-joke-draft:v1";
const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";
const SUBMITTER_TOKEN_KEY = "donkey:submitter-token:v1";

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
Add Joke Screen
=========================================================
*/

export default function AddJokeScreen() {
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
  Toast state
  -------------------------------------------------------
  */

const [toastMessage, setToastMessage] = useState<string | null>(null);
const [confirmVisible, setConfirmVisible] = useState(false);
const [confirmMessage, setConfirmMessage] = useState("");
const [confirmType, setConfirmType] = useState<"yesNo" | "submit">("yesNo");
const confirmActionRef = useRef<null | (() => void)>(null);
  

  /*
  -------------------------------------------------------
  Screen open timestamp
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
      setSubmitSuccess(false);
      setConfirmVisible(false);
      setLanguageModalOpen(false);
      setPreviewMode(false);
      await loadUser();
      await loadAppearanceSettings();
      await loadLanguageSetting();
      await loadDraft();
      setPreviewMode(false);
    };

    start();
  }, [isFocused]);

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
  };

  /*
  -------------------------------------------------------
  Load saved language preference
  -------------------------------------------------------
  */

  const loadLanguageSetting = async () => {
    try {
      const savedLang = await AsyncStorage.getItem(ADD_JOKE_LANGUAGE_KEY);

      if (savedLang && LANGUAGE_OPTIONS.includes(savedLang)) {
        setLanguage(savedLang);
        setLanguageDraft(savedLang);
      } else {
        setLanguage("English");
        setLanguageDraft("English");
      }
    } catch {
      setLanguage("English");
      setLanguageDraft("English");
    }
  };

  /*
  -------------------------------------------------------
  Load draft from phone memory
  -------------------------------------------------------
  */

  const loadDraft = async () => {
    try {
      const rawDraft = await AsyncStorage.getItem(ADD_JOKE_DRAFT_KEY);
      if (!rawDraft) return;

      const parsed = JSON.parse(rawDraft) as {
        jokeText?: string;
        language?: string;
      };

      if (parsed.jokeText && parsed.jokeText.trim()) {
        setJokeText(parsed.jokeText);
      } else {
        setJokeText("");
      }

      if (parsed.language && LANGUAGE_OPTIONS.includes(parsed.language)) {
        setLanguage(parsed.language);
        setLanguageDraft(parsed.language);
      }
    } catch {
      setJokeText("");
    }
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
  =======================================================
  HELPERS
  =======================================================
  */

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 5000);
  };

  const clearDraftMemory = async () => {
    setJokeText("");
    setPreviewMode(false);
    await AsyncStorage.removeItem(ADD_JOKE_DRAFT_KEY);
  };

  const saveDraftToPhone = async () => {
    const cleanText = jokeText.trim();

    await AsyncStorage.setItem(
      ADD_JOKE_DRAFT_KEY,
      JSON.stringify({
        jokeText: cleanText,
        language,
      })
    );
  };

  const openConfirm = (message: string, onConfirm: () => void, type: "yesNo" | "submit" = "yesNo") => {
  setConfirmMessage(message);
  setConfirmType(type);
  confirmActionRef.current = onConfirm;
  setConfirmVisible(true);
};

  /*
  =======================================================
  BUTTON ACTIONS
  =======================================================
  */

const handleCancelFromPageOne = () => {
  openConfirm("Are you sure you want to cancel?", async () => {
    await clearDraftMemory();
    router.replace("/(tabs)");
    showToast("Cancelled");
  });
};

const handleClearFromPageOne = () => {
  openConfirm("Clear this joke from the screen?", async () => {
    await clearDraftMemory();
    showToast("Screen cleared");
  });
};

  const handleSave = async () => {
    if (!jokeText.trim()) {
      Alert.alert("Nothing to save", "Please write a joke first.");
      return;
    }

    await saveDraftToPhone();
    router.replace("/(tabs)");
    showToast("Joke saved to phone memory");
  };

const handleDiscardFromPreview = () => {
  openConfirm("Are you sure you want to discard this joke?", async () => {
    await clearDraftMemory();
    router.replace("/(tabs)");
    showToast("Joke discarded");
  });
};

const handleSubmitConfirm = () => {
  openConfirm(
    "By adding a joke you agree with the Terms & Conditions and Community Guidelines.",
    submitJoke,
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
          "Please wait a few seconds before submitting another joke."
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
  SUBMIT JOKE
  =======================================================
  */

  const submitJoke = async () => {
    if (!jokeText.trim()) {
      Alert.alert("Empty joke", "Please write a joke first.");
      return;
    }

    if (busy) return;

    const allowedDelay = await checkSpamDelay();
    if (!allowedDelay) return;

    const allowedSpeed = checkBotSpeed();
    if (!allowedSpeed) return;

    try {
      setBusy(true);

      let anonymousToken: string | null = null;

      if (!currentUserId) {
        anonymousToken = await AsyncStorage.getItem(SUBMITTER_TOKEN_KEY);

        if (!anonymousToken || anonymousToken.length < 16) {
          anonymousToken =
            "anon_" +
            Date.now().toString() +
            "_" +
            Math.random().toString(36).slice(2, 12);

          await AsyncStorage.setItem(SUBMITTER_TOKEN_KEY, anonymousToken);
        }
      }

      const { error } = await supabase.from("jokes").insert({
        content: jokeText.trim(),
        language: language,
        user_id: currentUserId,
        submitter_token: anonymousToken,
        is_new: true,
        is_visible: false,
        updated_at: new Date().toISOString(),
      });

      if (error) throw error;

      await AsyncStorage.setItem(SPAM_KEY, String(Date.now()));
      await AsyncStorage.removeItem(ADD_JOKE_DRAFT_KEY);

      setPreviewMode(false);
      setSubmitSuccess(true);
      setJokeText("");
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit joke.");
    } finally {
      setBusy(false);
    }
  };

  /*
  =======================================================
  SUCCESS SCREEN
  Keep as before
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
          Joke submitted
        </Text>

        <Text
          style={[
            styles.successMessage,
            { fontSize: 15 * textScale, lineHeight: 22 * textScale },
            darkMode && styles.successMessageDark,
          ]}
        >
          It is now pending review, which should be done within the next 24 hours.
        </Text>

        <View style={styles.successButtons}>
          <Pressable
            style={styles.successButton}
            onPress={() => {
              setSubmitSuccess(false);
              router.push("/(tabs)/my-jokes");
            }}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Go to My Jokes
            </Text>
          </Pressable>

          <Pressable
            style={styles.successButton}
            onPress={() => {
              setSubmitSuccess(false);
              setJokeText("");
              setPreviewMode(false);
            }}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Submit new joke
            </Text>
          </Pressable>

          <Pressable
            style={styles.successButton}
            onPress={() => {
              setSubmitSuccess(false);
              router.push("/(tabs)");
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
          Preview
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
            {displayName ? displayName : "Anonymous"} • {language}
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
          By submitting a joke you agree to our{" "}
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
            style={styles.saveButton}
            onPress={handleSave}
          >
<Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale, textAlign: "center" }]}>
              Save Draft
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
              {busy ? "Submitting..." : "Submit"}
            </Text>
          </Pressable>
        </View>

        {confirmVisible && (
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
          setConfirmVisible(false);
          confirmActionRef.current?.();
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
          setConfirmVisible(false);
          confirmActionRef.current?.();
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
        )}
      </ScrollView>
    );
  }

  /*
  =======================================================
  ADD JOKE SCREEN
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
          Add a Joke
        </Text>

        {!currentUserId && (
          <Text
            style={[
              styles.anonymousNote,
              { fontSize: 13 * textScale },
              darkMode && styles.anonymousNoteDark,
            ]}
          >
            Posting as Anonymous. Create an account to manage your jokes later.
          </Text>
        )}

        <Text
          style={[
            styles.languageLabel,
            { fontSize: 13 * textScale },
            darkMode && styles.languageLabelDark,
          ]}
        >
          Select language first
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
          placeholder="Write your joke here..."
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
            style={[styles.cancelButtonSolid, styles.rowActionButton]}
            onPress={handleCancelFromPageOne}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Cancel
            </Text>
          </Pressable>

          <Pressable
            style={[styles.clearButton, styles.rowActionButton]}
            onPress={handleClearFromPageOne}
          >
            <Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale }]}>
              Clear
            </Text>
          </Pressable>

          <Pressable
            style={[styles.saveButton, styles.rowActionButton]}
            onPress={handleSave}
          >
<Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale, textAlign: "center" }]}>
              Save Draft
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.previewButton,
              styles.rowActionButton,
              !jokeText.trim() && styles.previewButtonDisabled,
            ]}
            disabled={!jokeText.trim()}
            onPress={() => setPreviewMode(true)}
          >
<Text style={[styles.buttonTextWhite, { fontSize: 15 * textScale, textAlign: "center" }]}>
              Preview /{"\n"}Publish
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
                  style={styles.saveButton}
                  onPress={() => setLanguageModalOpen(false)}
                >
                  <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
                    Cancel
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.submitButton}
                  onPress={async () => {
                    setLanguage(languageDraft);
                    await AsyncStorage.setItem(ADD_JOKE_LANGUAGE_KEY, languageDraft);
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

{confirmVisible && (
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
      setConfirmVisible(false);
      confirmActionRef.current?.();
    }}
  >
    <Text style={[styles.buttonTextWhite, { fontSize: 14 * textScale }]}>
      Yes
    </Text>
  </Pressable>
</View>
    </View>
  </View>
)}

      {toastMessage && (
        <View pointerEvents="none" style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
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

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

    logoOnlyTop: {
    alignItems: "flex-end",
    marginBottom: 14,
  },

  backButtonTop: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  backButtonTopDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  backButtonTopText: {
    color: "#111",
    fontWeight: "600",
  },

  backButtonTopTextDark: {
    color: "#f3f3f3",
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

  anonymousNote: {
    color: "#777",
    marginBottom: 10,
  },

  anonymousNoteDark: {
    color: "#bdbdbd",
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
    flex: 1,
    backgroundColor: "#c62828",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

saveButton: {
    flex: 1,
    backgroundColor: "#757575",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },

    clearButton: {
    flex: 1,
    backgroundColor: "#ef6c00",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },

  rowActionButton: {
    paddingHorizontal: 8,
  },

previewButton: {
    flex: 1,
    backgroundColor: "#2f71d3",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
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

  toastContainer: {
    position: "absolute",
    bottom: 80,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },

  toastText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "600",
  },
});