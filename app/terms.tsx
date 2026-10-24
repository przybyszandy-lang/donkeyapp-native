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
import termsData from "../lib/terms.json";

// Same text as the website terms page (website copy is generated from lib/terms.json).
type TermsSection = { title: string; paragraphs: string[]; list?: string[]; after?: string[] };
const TERMS = termsData as { updated: string; intro: string[]; sections: TermsSection[] };

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
        <Text style={[styles.title, { color: text, fontSize: 22 * textScale }]}>
          Terms & Conditions
        </Text>

        <Text style={[styles.smallNote, { color: subtext, fontSize: 13 * textScale }]}>
          Last updated: {TERMS.updated}
        </Text>

        {TERMS.intro.map((p, i) => (
          <Text key={`intro-${i}`} style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
            {p}
          </Text>
        ))}

        {TERMS.sections.map((section) => (
          <View key={section.title}>
            <Text style={[styles.section, { color: text, fontSize: 18 * textScale }]}>
              {section.title}
            </Text>
            {section.paragraphs.map((p, i) => (
              <Text key={`p-${i}`} style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
                {p}
              </Text>
            ))}
            {section.list?.map((item, i) => (
              <View key={`l-${i}`} style={styles.bulletRow}>
                <Text style={[styles.paragraph, styles.bullet, { color: text, fontSize: 15 * textScale }]}>•</Text>
                <Text style={[styles.paragraph, styles.bulletText, { color: text, fontSize: 15 * textScale }]}>
                  {item}
                </Text>
              </View>
            ))}
            {section.after?.map((p, i) => (
              <Text key={`a-${i}`} style={[styles.paragraph, { color: text, fontSize: 15 * textScale }]}>
                {p}
              </Text>
            ))}
          </View>
        ))}
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

  bulletRow: {
    flexDirection: "row",
    paddingLeft: 4,
  },
  bullet: {
    width: 16,
    marginBottom: 6,
  },
  bulletText: {
    flex: 1,
    marginBottom: 6,
  },
  paragraph: {
    lineHeight: 22,
    marginBottom: 10,
  },

});