// app/terms.tsx

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

export default function TermsScreen() {

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
Terms & Conditions
</Text>

<Text style={[styles.smallNote, { color: subtext, fontSize: 13 * textScale }]}>
  Last updated: April 2026
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  These Terms and Conditions govern your use of DonkeyApp. By using the platform,
  you agree to these Terms. If you do not agree, please do not use DonkeyApp.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  1. Purpose of the Platform
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp is a platform where users can submit and read jokes. The goal
  of the platform is to promote humour and allow users to share funny content
  with others.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  2. Entertainment Disclaimer
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp is a humour and entertainment platform. Content may include satire,
  exaggeration, or controversial humour. All content is intended for entertainment
  purposes only and should not be interpreted as factual, educational, political,
  or professional advice.
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Some users may find certain jokes offensive or inappropriate. Due to the nature
  of humour and user-generated content, it is not possible to prevent all content
  that may offend individuals. If you are likely to be offended by humour, satire,
  or controversial topics, you should not use the platform.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  3. User Accounts
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Some features require creating an account. When using an account you are
  responsible for maintaining the security of your login and for any content
  submitted through your account.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  4. User-Generated Content and Moderation
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Content on DonkeyApp is primarily user-generated. While moderation is applied,
  we cannot guarantee that all content will be suitable for all audiences.
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp reserves the right to review, reject, remove, or restrict any content
  at its sole discretion. Content may be removed if deemed inappropriate,
  offensive, harmful, or inconsistent with platform guidelines.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  5. Submitting Jokes
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Users may submit jokes to be published on DonkeyApp. Jokes that comply with
  these Terms and the Community Guidelines may be published on the platform.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  6. Acceptable Content
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Content submitted to DonkeyApp must comply with the Community Guidelines.
  Content that violates these guidelines may be removed.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  7. Account Suspension
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp reserves the right to suspend or remove accounts that repeatedly
  violate platform rules or misuse the platform.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  8. Reporting Content
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  Users may report content using the report button available on jokes.
  Reported content will be reviewed and may be removed if it violates
  platform rules or guidelines.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  9. Ownership of Content
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  When you submit a joke to DonkeyApp, you confirm that the joke is either
  your original creation or a commonly known joke without enforceable copyright.
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  By submitting content, you grant DonkeyApp a non-exclusive, worldwide,
  royalty-free licence to display, store, and distribute that content.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  10. Sharing Content
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  You are free to share jokes found on DonkeyApp for personal use. Automated
  scraping or bulk copying is not permitted.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  11. Advertising
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  DonkeyApp may display advertising to support platform operation.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  12. Changes to These Terms
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  These Terms and Conditions may change from time to time. Continued use
  of DonkeyApp constitutes acceptance of any changes.
</Text>

<Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
  13. Contact Us
</Text>

<Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
  If you have questions about these Terms and Conditions, please use the
  Contact Us page within the app.
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