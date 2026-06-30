// app/guidelines.tsx

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

export default function GuidelinesScreen() {

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
          Community Guidelines
        </Text>

        <Text style={[styles.smallNote, { color: subtext, fontSize: 13 * textScale }]}>
          Last updated: March 2026
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          DonkeyApp is a platform created for humour. The goal of this community
          is to share jokes and entertainment. The platform is not intended to be
          used for abuse, harassment, or derogatory political messaging.
        </Text>

        <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
          1. Humour First
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          Content on DonkeyApp should be intended as humour. The platform exists
          to make people laugh and enjoy jokes shared by others.
        </Text>

        <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
          2. Respect the Community
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          While humour can be bold and sometimes controversial, content that is
          primarily intended to harass, threaten, or abuse others is not allowed.
        </Text>

        <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
          3. Prohibited Content
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          The following types of content are not allowed on DonkeyApp:
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          • content involving child exploitation or abuse{"\n"}
          • explicit encouragement of violence{"\n"}
          • direct harassment of individuals{"\n"}
          • hate speech or racist content{"\n"}
          • jokes about genocides or human tragedies presented in a derogatory way
        </Text>

        <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
          4. Context Matters
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          We understand that humour can sometimes approach sensitive topics.
          However, content that crosses into clear abuse or discrimination will
          be removed.
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          Even if a joke may sound humorous to some audiences, it may still be
          removed if it violates these guidelines.
        </Text>

        <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
          5. Moderation
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          DonkeyApp reserves the right to remove content that violates these
          guidelines or harms the community experience.
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          Repeated violations may lead to account restrictions or removal.
        </Text>

        <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
          6. Reporting Issues
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          If you encounter content that violates these guidelines, please report
          it through the app so it can be reviewed.
        </Text>

        <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
          7. Contact Us
        </Text>

        <Text style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
          If you have questions about these guidelines, please use the Contact Us
          page within the app.
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