// Add Content tab: choose to add a joke, a meme or a video.
import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIsFocused } from "@react-navigation/native";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";

type Option = {
  key: string;
  title: string;
  subtitle: string;
  icon: keyof typeof MaterialIcons.glyphMap;
  onPress: () => void;
};

export default function AddContentScreen() {
  const isFocused = useIsFocused();
  const [darkMode, setDarkMode] = useState(false);
  const [textScale, setTextScale] = useState(1);

  useEffect(() => {
    if (!isFocused) return;
    (async () => {
      try {
        const [rawDark, rawText] = await Promise.all([
          AsyncStorage.getItem(DARK_MODE_KEY),
          AsyncStorage.getItem(TEXT_SIZE_KEY),
        ]);
        setDarkMode(rawDark === "true");
        setTextScale(rawText === "Small" ? 0.9 : rawText === "Large" ? 1.2 : 1);
      } catch {
        setDarkMode(false);
        setTextScale(1);
      }
    })();
  }, [isFocused]);

  const options: Option[] = [
    {
      key: "joke",
      title: "Add a joke",
      subtitle: "Write a joke in your own words.",
      icon: "text-fields",
      onPress: () => router.navigate("/(tabs)/add-joke"),
    },
    {
      key: "meme",
      title: "Add a meme",
      subtitle: "Upload a picture from your phone.",
      icon: "image",
      onPress: () => router.push({ pathname: "/upload", params: { type: "meme" } }),
    },
    {
      key: "video",
      title: "Add a video",
      subtitle: "Upload a short video (up to 90 seconds).",
      icon: "videocam",
      onPress: () => router.push({ pathname: "/upload", params: { type: "video" } }),
    },
  ];

  return (
    <ScrollView
      style={[styles.screen, darkMode && styles.screenDark]}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.logoTop}>
        <Image source={require("../../assets/logo.png")} style={styles.logo} resizeMode="contain" />
      </View>

      <Text style={[styles.title, { fontSize: 22 * textScale }, darkMode && styles.textLight]}>
        Add Content
      </Text>

      {options.map((option) => (
        <Pressable
          key={option.key}
          style={({ pressed }) => [
            styles.card,
            darkMode && styles.cardDark,
            pressed && styles.cardPressed,
          ]}
          onPress={option.onPress}
        >
          <View style={styles.iconCircle}>
            <MaterialIcons name={option.icon} size={28} color="#fff" />
          </View>
          <View style={styles.cardText}>
            <Text style={[styles.cardTitle, { fontSize: 18 * textScale }, darkMode && styles.textLight]}>
              {option.title}
            </Text>
            <Text
              style={[styles.cardSubtitle, { fontSize: 14 * textScale }, darkMode && styles.textMuted]}
            >
              {option.subtitle}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={26} color={darkMode ? "#888" : "#999"} />
        </Pressable>
      ))}

      <Text style={[styles.note, { fontSize: 13 * textScale }, darkMode && styles.textMuted]}>
        Memes and videos are checked by our team before they appear in the app. This is done by
        hand, so it may take a little while.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#efefef" },
  screenDark: { backgroundColor: "#101010" },
  content: { padding: 16, paddingBottom: 32 },
  logoTop: { alignItems: "flex-end", marginBottom: 14 },
  logo: { width: 44, height: 44 },
  title: { fontWeight: "700", color: "#111", marginBottom: 16, textAlign: "center" },
  textLight: { color: "#f3f3f3" },
  textMuted: { color: "#bdbdbd" },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 16,
    marginBottom: 12,
  },
  cardDark: { backgroundColor: "#1b1b1b", borderColor: "#333" },
  cardPressed: { opacity: 0.7 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#1877f2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  cardText: { flex: 1 },
  cardTitle: { fontWeight: "700", color: "#111" },
  cardSubtitle: { color: "#666", marginTop: 2 },
  note: { color: "#666", textAlign: "center", marginTop: 8, lineHeight: 19 },
});
