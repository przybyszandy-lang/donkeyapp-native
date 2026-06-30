// Path: app/contact-us.tsx

// Contact Us screen
// Simplified version:
// - Message box first
// - Name optional
// - Email optional
// - Message must be 20 to 3000 characters
// - Keeps dark mode and text size settings
// - Shows simple thank-you message after successful send

import React, { useEffect, useRef, useState } from "react";
import {
  Alert,
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
import { router } from "expo-router";
import { supabase } from "../lib/supabase";

// Saved settings keys
const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";

export default function ContactUsScreen() {
  // Appearance settings
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");

  // Form fields
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [messageSent, setMessageSent] = useState(false);
  const [nameError, setNameError] = useState(false);
    const [emailError, setEmailError] = useState(false);

  // Used to scroll the page when the keyboard opens
  const scrollRef = useRef<ScrollView>(null);

  // Text size scaling based on saved app setting
  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;

  // Load saved appearance settings when the page opens
  useEffect(() => {
    loadAppearanceSettings();
  }, []);

  // Reads dark mode and text size from storage
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
    } catch (e) {
      console.log("Failed to load contact us appearance settings:", e);
      setDarkMode(false);
      setTextSize("Normal");
    }
  };

  // Sends the message to Supabase
  const submitMessage = async () => {
    const cleanMessage = message.trim();
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    // Message must be at least 20 characters

    if (cleanMessage.length < 20) {
      Alert.alert("Message too short", "Please write at least 20 characters.");
      return;
    }

    if (cleanName.length < 1) {
      setNameError(true);
      return;
    }

    setNameError(false);

    if (
      cleanEmail.length > 0 &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)
    ) {
      setEmailError(true);
      return;
    }

    setEmailError(false);

    try {
      setSubmitting(true);

      const { error } = await supabase.from("contact_messages").insert({
        name: cleanName,
        email: cleanEmail || null,
        reason: "Other",
        message: cleanMessage,
      });

      if (error) {
        throw error;
      }

      // Clear form and show thank-you state
      setMessage("");
      setName("");
      setEmail("");
      setMessageSent(true);
    } catch (e: any) {
      console.log("Contact request failed:", e);
      Alert.alert("Error", e?.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  // Thank-you screen shown after successful submit
  if (messageSent) {
    return (
      <ScrollView
        style={[styles.screen, darkMode && styles.screenDark]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <Pressable
          style={[styles.backButton, darkMode && styles.backButtonDark]}
          onPress={() => router.back()}
        >
          <Text
            style={[
              styles.backButtonText,
              { fontSize: 15 * textScale },
              darkMode && styles.backButtonTextDark,
            ]}
          >
            ← Back
          </Text>
        </Pressable>

        <Text
          style={[
            styles.title,
            { fontSize: 24 * textScale },
            darkMode && styles.titleDark,
          ]}
        >
          Thank you
        </Text>

        <View style={[styles.thankYouBox, darkMode && styles.thankYouBoxDark]}>
          <Text
            style={[
              styles.thankYouText,
              { fontSize: 16 * textScale, lineHeight: 23 * textScale },
              darkMode && styles.thankYouTextDark,
            ]}
          >
            Thank you for submitting your message.
          </Text>

          <Text
            style={[
              styles.thankYouText,
              { fontSize: 16 * textScale, lineHeight: 23 * textScale },
              darkMode && styles.thankYouTextDark,
            ]}
          >
            If you left your email address, we aim to respond within 72 hours.
          </Text>
        </View>

        <Pressable
          style={styles.sendButton}
          onPress={() => setMessageSent(false)}
        >
          <Text
            style={[
              styles.sendButtonText,
              { fontSize: 15 * textScale },
            ]}
          >
            Send another message
          </Text>
        </Pressable>
      </ScrollView>
    );
  }

  // Main form screen
  return (
    <KeyboardAvoidingView
      style={[styles.screen, darkMode && styles.screenDark]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 20}
    >
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentInsetAdjustmentBehavior="always"
      >
        <Pressable
          style={[styles.backButton, darkMode && styles.backButtonDark]}
          onPress={() => router.back()}
        >
          <Text
            style={[
              styles.backButtonText,
              { fontSize: 15 * textScale },
              darkMode && styles.backButtonTextDark,
            ]}
          >
            ← Back
          </Text>
        </Pressable>

        <Text
          style={[
            styles.title,
            { fontSize: 24 * textScale },
            darkMode && styles.titleDark,
          ]}
        >
          Type your message here
        </Text>

        {/* Message label */}
        <Text
          style={[
            styles.label,
            { fontSize: 13 * textScale },
            darkMode && styles.labelDark,
          ]}
        >
          Message
        </Text>

        {/* Main message box */}
        <TextInput
          style={[
            styles.messageInput,
            {
              fontSize: 16 * textScale,
              lineHeight: 22 * textScale,
            },
            darkMode && styles.inputDark,
          ]}
          placeholder="Write your message here..."
          placeholderTextColor={darkMode ? "#999" : "#888"}
          value={message}
          onChangeText={setMessage}
          multiline
          textAlignVertical="top"
          maxLength={3000}
          returnKeyType="default"
          blurOnSubmit={false}
          onFocus={() => {
            setTimeout(() => {
              scrollRef.current?.scrollToEnd({ animated: true });
            }, 250);
          }}
        />

        {/* Character counter */}
        <Text
          style={[
            styles.counter,
            { fontSize: 12 * textScale },
            darkMode && styles.counterDark,
          ]}
        >
          {message.length} / 3000 (minimum 20)
        </Text>

        {/* Optional name */}
        <Text
          style={[
            styles.label,
            { fontSize: 13 * textScale },
            darkMode && styles.labelDark,
            nameError && styles.labelError,
          ]}
        >
          Name (Minimum 1 Character)
        </Text>

        <TextInput
          style={[
            styles.input,
            { fontSize: 15 * textScale },
            darkMode && styles.inputDark,
            nameError && styles.inputError,
          ]}
          placeholder="Your name"
          placeholderTextColor={darkMode ? "#999" : "#888"}
          value={name}
          onChangeText={(value) => {
            setName(value);
            if (value.trim().length >= 1) {
              setNameError(false);
            }
          }}
          maxLength={100}
        />

        {/* Optional email */}
        <Text
          style={[
            styles.label,
            { fontSize: 13 * textScale },
            darkMode && styles.labelDark,
            emailError && styles.labelError,
          ]}
        >
          {emailError ? "Please enter a valid email address" : "Email (optional)"}
        </Text>

        <TextInput
          style={[
            styles.input,
            { fontSize: 15 * textScale },
            darkMode && styles.inputDark,
            emailError && styles.inputError,
          ]}
          placeholder="Your email"
          placeholderTextColor={darkMode ? "#999" : "#888"}
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (
              value.trim().length === 0 ||
              /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
            ) {
              setEmailError(false);
            }
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          maxLength={200}
        />

        {/* Send button */}
        <Pressable
          style={[
            styles.sendButton,
            submitting && styles.sendButtonDisabled,
          ]}
          onPress={submitMessage}
          disabled={submitting}
        >
          <Text
            style={[
              styles.sendButtonText,
              { fontSize: 15 * textScale },
            ]}
          >
            {submitting ? "Sending..." : "Send message"}
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// Screen styles
const styles = StyleSheet.create({
  // Main screen background
  screen: {
    flex: 1,
    backgroundColor: "#efefef",
    padding: 16,
  },

  // Dark mode screen background
  screenDark: {
    backgroundColor: "#101010",
  },

  // Scroll area spacing
  scrollContent: {
    paddingBottom: 28,
  },

  // Back button
  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  // Back button dark mode
  backButtonDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  // Back button text
  backButtonText: {
    color: "#111",
    fontWeight: "600",
  },

  // Back button text dark mode
  backButtonTextDark: {
    color: "#f3f3f3",
  },

  // Main title
  title: {
    fontSize: 24,
    color: "#111",
    fontWeight: "700",
    marginBottom: 12,
  },

  // Main title dark mode
  titleDark: {
    color: "#f3f3f3",
  },

  // Labels above boxes
  label: {
    fontSize: 13,
    color: "#555",
    marginBottom: 6,
    marginTop: 10,
  },

  // Labels dark mode
  labelDark: {
    color: "#bdbdbd",
  },

    labelError: {
    color: "#c62828",
    fontWeight: "700",
  },

  // Regular input box
  input: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 12,
    paddingVertical: 12,
    color: "#111",
  },

  // Regular input box dark mode
  inputDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
    color: "#f3f3f3",
  },

    inputError: {
    borderColor: "#c62828",
    borderWidth: 2,
  },

  // Large message box
  messageInput: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#ddd",
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 220,
    marginBottom: 8,
    color: "#111",
  },

  // Character counter
  counter: {
    marginTop: 6,
    textAlign: "right",
    color: "#777",
  },

  // Character counter dark mode
  counterDark: {
    color: "#bdbdbd",
  },

  // Main send button
  sendButton: {
    marginTop: 20,
    backgroundColor: "#2f71d3",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  // Disabled send button
  sendButtonDisabled: {
    backgroundColor: "#9bb6e6",
  },

  // Send button text
  sendButtonText: {
    color: "#fff",
    fontWeight: "700",
  },

  // Thank-you box
  thankYouBox: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: "#ddd",
    marginTop: 8,
    marginBottom: 20,
  },

  // Thank-you box dark mode
  thankYouBoxDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  // Thank-you text
  thankYouText: {
    color: "#333",
    marginBottom: 12,
  },

  // Thank-you text dark mode
  thankYouTextDark: {
    color: "#e5e5e5",
  },
});