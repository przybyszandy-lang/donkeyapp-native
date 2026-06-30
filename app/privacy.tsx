// app/privacy.tsx

import { router } from "expo-router";
import React, { useEffect, useState } from "react";

import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import AsyncStorage from "@react-native-async-storage/async-storage";

export default function PrivacyScreen() {

  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");
  const [darkMode, setDarkMode] = useState(false);

  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;

  useEffect(() => {
    (async () => {
      try {
        const rawText = await AsyncStorage.getItem("donkey:textsize:v1");
        if (rawText) setTextSize(rawText as "Small" | "Normal" | "Large");

        const rawDark = await AsyncStorage.getItem("donkey:darkmode:v1");
        if (rawDark) setDarkMode(rawDark === "true");
      } catch (e) {
        console.log("Failed to load appearance settings:", e);
      }
    })();
  }, []);

  const background = darkMode ? "#121212" : "#efefef";
  const card = darkMode ? "#1e1e1e" : "#ffffff";
  const text = darkMode ? "#f2f2f2" : "#111";
  const subtext = darkMode ? "#bbbbbb" : "#555";

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: background }]}
      contentContainerStyle={styles.content}
    >
      <View style={styles.topBar}>

        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={[styles.backButtonText, { color: text }]}>
            ← Back to jokes
          </Text>
        </Pressable>

        <Image
          source={require("../assets/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

      </View>

      <View style={[styles.card, { backgroundColor: card }]}>

        <Text
          style={[
            styles.title,
            { color: text, fontSize: 22 * textScale }
          ]}
        >
          Privacy Policy
        </Text>

        <Text style={[styles.smallNote, { color: subtext, fontSize: 13 * textScale }]}>
  Last updated: April 2026
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp is committed to protecting your privacy. This Privacy Policy explains
  what information we collect, why we collect it, and how it is used.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  1. Email Address
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  When you create an account or sign in, DonkeyApp stores your email address.
  Your email address is used only for logging in to your account and for
  sending one-time login codes.
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Your email address is not visible to other users and is never sold or shared.
  It is stored only for as long as your account exists.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  2. Display Name
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  When you create an account you may choose a display name. Your display name
  identifies you as the author of jokes you submit.
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Display names must be between 1 and 25 characters and must comply with the
  Terms & Conditions and Community Guidelines.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  3. Jokes and User Content
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  When you submit jokes, DonkeyApp stores that content so it can be displayed
  to other users, moderated, and managed by you through your account.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  4. Device Data Stored Locally
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Some data is stored locally on your device to improve your experience.
  This includes favourite jokes, votes, seen jokes, and appearance settings.
  This information remains on your device and is not transmitted to our servers.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  5. 5. Website Analytics and Cookies
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp webiste uses cookies and similar technologies to improve performance,
  understand usage, and support advertising. These may include analytics
  providers such as Google Analytics.
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Cookies may store anonymised usage data such as pages visited, device type,
  and general location. You can accept or reject cookies using the privacy
  controls on this website.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  6. Third-Party Services
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp uses trusted third-party services to operate the platform. These may include:
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  • Supabase — authentication and database hosting{"\n"}
  • Google Analytics — usage analytics
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  These providers process data only as necessary to provide their services.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  7. Your Rights
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Depending on your location, you may have rights regarding your personal data,
  including the right to access, correct, delete, or restrict processing of your data.
  You may also withdraw consent at any time.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  8. Account Deletion
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  You may delete your account at any time. When your account is deleted,
  your email address and profile information will be removed from active
  systems within 72 hours.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  9. Changes to This Policy
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  This Privacy Policy may change from time to time. If significant changes
  occur, users will be informed through the app.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  10. Contact Us
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  If you have questions about this Privacy Policy or about how your data is
  handled, please use the Contact Us page within the app.
</Text>

      </View>

    </ScrollView>
  );
}

const styles = StyleSheet.create({

  screen: {
    flex: 1,
  },

  content: {
    padding: 16,
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },

  backButton: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  backButtonText: {
    fontSize: 15,
    fontWeight: "600",
  },

  logo: {
    width: 44,
    height: 44,
  },

  card: {
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  title: {
    fontWeight: "600",
    marginBottom: 6,
  },

  smallNote: {
    marginBottom: 14,
  },

  section: {
    marginTop: 14,
    marginBottom: 6,
    fontWeight: "600",
  },

  paragraph: {
    lineHeight: 22,
    marginBottom: 10,
  },

});