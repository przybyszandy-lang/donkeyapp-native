import { useIsFocused } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/open-sans";

import { supabase } from "../../lib/supabase";

type MyJokeRow = {
  id: string;
  content: string;
  created_at: string;
  is_new: boolean;
  is_visible: boolean;
  rating_bad_count: number | null;
  rating_meh_count: number | null;
  rating_good_count: number | null;
  rating_great_count: number | null;
  average: number | null;
};

const PAGE_SIZE = 50;
const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";

export default function MyJokesScreen() {
  const [fontsLoaded] = useFonts({
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [jokes, setJokes] = useState<MyJokeRow[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedJokeId, setCopiedJokeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [deletingJokeId, setDeletingJokeId] = useState<string | null>(null);
  const [jokePendingDelete, setJokePendingDelete] = useState<MyJokeRow | null>(null);

  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");
  const isFocused = useIsFocused();

  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;

  useEffect(() => {
    loadAppearanceSettings();

    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.log("Get current user failed:", error);
        setCurrentUserId(null);
        setLoadingInitial(false);
        return;
      }

      setCurrentUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
      loadAppearanceSettings();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    loadAppearanceSettings();

    if (!currentUserId) {
      setJokes([]);
      setLoadingInitial(false);
      return;
    }

    loadInitial(currentUserId);
  }, [currentUserId, isFocused]);

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
      console.log("Failed to load My Jokes appearance settings:", e);
      setDarkMode(false);
      setTextSize("Normal");
    }
  };

  const loadInitial = async (userId: string) => {
    setLoadingInitial(true);
    setErrorText(null);

    try {
      await loadAppearanceSettings();

      const from = 0;
      const to = PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("jokes")
        .select(
          "id, content, created_at, is_new, is_visible, rating_bad_count, rating_meh_count, rating_good_count, rating_great_count, average"
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = (data ?? []) as MyJokeRow[];

      setJokes(rows);
      setPage(1);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e: any) {
      setErrorText(e?.message ?? "Failed to load your jokes.");
    } finally {
      setLoadingInitial(false);
    }
  };

  const loadMore = async () => {
    if (!currentUserId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    setErrorText(null);

    try {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error } = await supabase
        .from("jokes")
        .select(
          "id, content, created_at, is_new, is_visible, rating_bad_count, rating_meh_count, rating_good_count, rating_great_count, average"
        )
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = (data ?? []) as MyJokeRow[];

      setJokes((prev) => [...prev, ...rows]);
      setPage((prev) => prev + 1);
      setHasMore(rows.length === PAGE_SIZE);
    } catch (e: any) {
      setErrorText(e?.message ?? "Failed to load more jokes.");
    } finally {
      setLoadingMore(false);
    }
  };

  const getStatusText = (item: MyJokeRow) => {
    if (item.is_visible) return "Approved";
    if (!item.is_visible && item.is_new) return "Pending Review";
    return "Not Approved";
  };

  const getVoteCount = (item: MyJokeRow) => {
    return (
      (item.rating_bad_count ?? 0) +
      (item.rating_meh_count ?? 0) +
      (item.rating_good_count ?? 0) +
      (item.rating_great_count ?? 0)
    );
  };

  const formatScore = (value: number | null) => {
    if (value === null || Number.isNaN(value)) return "0.0";
    return Number(value).toFixed(1);
  };

  const formatDate = (value: string) => {
    if (!value) return "";

    const date = new Date(value);

    if (isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const onPressCopy = async (jokeText: string, jokeId: string) => {
    const textWithAttribution =
      jokeText.trim() +
      `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

    await Clipboard.setStringAsync(textWithAttribution);

    setCopiedJokeId(jokeId);
    setToastMessage("Joke copied. Share it however you want!");

    setTimeout(() => {
      setCopiedJokeId(null);
      setToastMessage(null);
    }, 2500);
  };

  const handleShareJoke = async (text: string, jokeId: string) => {
    if (!text || !text.trim()) return;

    const shareText =
      text.trim() +
      `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

    try {
      await Share.share({ message: shareText });
      setToastMessage("Sharing opened.");
      setTimeout(() => setToastMessage(null), 2000);
    } catch (e) {
      await Clipboard.setStringAsync(shareText);
      setToastMessage("Joke copied. Share it however you want!");
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  const onPressEdit = (jokeId: string) => {
    router.push({
      pathname: "/(tabs)/edit-joke",
      params: { jokeId },
    });
  };

  const confirmDelete = async () => {
    if (!jokePendingDelete) return;

    const item = jokePendingDelete;

    try {
      setDeletingJokeId(item.id);
      setErrorText(null);

      const shouldArchive =
        item.is_visible === true && (item.average ?? 0) >= 0.75;

      if (shouldArchive) {
        const { error } = await supabase
          .from("jokes")
          .update({
            user_id: null,
            added_by_email: "deleted@donkeyapp.com",
            is_visible: false,
            is_new: false,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.id)
          .eq("user_id", currentUserId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("jokes")
          .delete()
          .eq("id", item.id)
          .eq("user_id", currentUserId);

        if (error) throw error;
      }

      setJokes((prev) => prev.filter((joke) => joke.id !== item.id));
      setToastMessage("Joke removed.");

      setTimeout(() => {
        setToastMessage(null);
      }, 2500);
    } catch (e: any) {
      setErrorText(e?.message ?? "Failed to remove joke.");
    } finally {
      setDeletingJokeId(null);
      setJokePendingDelete(null);
    }
  };

  const renderItem = ({ item }: { item: MyJokeRow }) => {
    return (
      <View
        style={[
          styles.card,
          darkMode && styles.cardDark,
        ]}
      >
        <Text
          style={[
            styles.jokeText,
            {
              fontSize: 16 * textScale,
              lineHeight: 22 * textScale,
            },
            darkMode && styles.jokeTextDark,
          ]}
          numberOfLines={2}
        >
          {item.content}
        </Text>

        <Text
          style={[
            styles.infoLine,
            {
              fontSize: 13 * textScale,
              lineHeight: 18 * textScale,
            },
            darkMode && styles.infoLineDark,
          ]}
        >
          {getStatusText(item)} • Score {formatScore(item.average)} • {getVoteCount(item)} votes •{" "}
          {formatDate(item.created_at)}
        </Text>

        <View style={styles.cardFooter}>
          <Pressable
            style={[
              styles.iconButton,
              darkMode && styles.iconButtonDark,
            ]}
            onPress={() => onPressCopy(item.content, item.id)}
          >
            <MaterialIcons
              name={copiedJokeId === item.id ? "check" : "content-copy"}
              size={22}
              color={copiedJokeId === item.id ? "#2e7d32" : darkMode ? "#f3f3f3" : "#333"}
            />
          </Pressable>

          <Pressable
            style={[
              styles.iconButton,
              darkMode && styles.iconButtonDark,
            ]}
            onPress={() => handleShareJoke(item.content, item.id)}
          >
            <MaterialIcons
              name="share"
              size={22}
              color={darkMode ? "#f3f3f3" : "#333"}
            />
          </Pressable>

          <Pressable
            style={[
              styles.iconButton,
              darkMode && styles.iconButtonDark,
            ]}
            onPress={() => onPressEdit(item.id)}
          >
            <MaterialIcons
              name="edit"
              size={22}
              color={darkMode ? "#f3f3f3" : "#333"}
            />
          </Pressable>

          <Pressable
            style={[
              styles.iconButton,
              darkMode && styles.iconButtonDark,
              deletingJokeId === item.id && styles.iconButtonDisabled,
            ]}
            onPress={() => setJokePendingDelete(item)}
            disabled={deletingJokeId === item.id}
          >
            <MaterialIcons
              name={deletingJokeId === item.id ? "hourglass-top" : "delete-outline"}
              size={22}
              color={darkMode ? "#f3f3f3" : "#333"}
            />
          </Pressable>
        </View>
      </View>
    );
  };

  if (!fontsLoaded) {
    return <View style={[styles.screen, darkMode && styles.screenDark]} />;
  }

  if (loadingInitial) {
    return (
      <View style={[styles.screen, darkMode && styles.screenDark]}>
        <View style={styles.topBar}>
          <Pressable
            style={[
              styles.backButton,
              darkMode && styles.backButtonDark,
            ]}
            onPress={() => router.back()}
          >
            <Text
              style={[
                styles.backButtonText,
                { fontSize: 15 * textScale },
                darkMode && styles.backButtonTextDark,
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

        <Text
          style={[
            styles.title,
            { fontSize: 22 * textScale },
            darkMode && styles.titleDark,
          ]}
        >
          My Jokes
        </Text>

        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text
            style={[
              styles.smallNote,
              { fontSize: 13 * textScale },
              darkMode && styles.smallNoteDark,
            ]}
          >
            Loading your jokes…
          </Text>
        </View>
      </View>
    );
  }

  if (!currentUserId) {
    return (
      <View style={[styles.screen, darkMode && styles.screenDark]}>
        <View style={styles.topBar}>
          <Pressable
            style={[
              styles.backButton,
              darkMode && styles.backButtonDark,
            ]}
            onPress={() => router.back()}
          >
            <Text
              style={[
                styles.backButtonText,
                { fontSize: 15 * textScale },
                darkMode && styles.backButtonTextDark,
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

        <Text
          style={[
            styles.title,
            { fontSize: 22 * textScale },
            darkMode && styles.titleDark,
          ]}
        >
          My Jokes
        </Text>

        <Text
          style={[
            styles.emptyText,
            { fontSize: 15 * textScale, lineHeight: 22 * textScale },
            darkMode && styles.emptyTextDark,
          ]}
        >
          Please sign in to see your jokes.
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.screen, darkMode && styles.screenDark]}>
      <View style={styles.topBar}>
        <Pressable
          style={[
            styles.backButton,
            darkMode && styles.backButtonDark,
          ]}
          onPress={() => router.back()}
        >
          <Text
            style={[
              styles.backButtonText,
              { fontSize: 15 * textScale },
              darkMode && styles.backButtonTextDark,
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

      <Text
        style={[
          styles.title,
          { fontSize: 22 * textScale },
          darkMode && styles.titleDark,
        ]}
      >
        My Jokes
      </Text>

      {errorText ? (
        <View
          style={[
            styles.errorBanner,
            darkMode && styles.errorBannerDark,
          ]}
        >
          <Text
            style={[
              styles.errorText,
              { fontSize: 14 * textScale },
              darkMode && styles.errorTextDark,
            ]}
          >
            {errorText}
          </Text>
          <Pressable onPress={() => loadInitial(currentUserId)}>
            <Text
              style={[
                styles.retryText,
                { fontSize: 14 * textScale },
                darkMode && styles.retryTextDark,
              ]}
            >
              Retry
            </Text>
          </Pressable>
        </View>
      ) : null}

      {jokes.length === 0 ? (
        <Text
          style={[
            styles.emptyText,
            { fontSize: 15 * textScale, lineHeight: 22 * textScale },
            darkMode && styles.emptyTextDark,
          ]}
        >
          You have not added any jokes yet.
        </Text>
      ) : (
        <FlatList
          data={jokes}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ListFooterComponent={
            <View style={styles.footer}>
              {loadingMore ? (
                <ActivityIndicator />
              ) : hasMore ? (
                <Pressable
                  style={[
                    styles.loadMoreButton,
                    darkMode && styles.loadMoreButtonDark,
                  ]}
                  onPress={loadMore}
                >
                  <Text
                    style={[
                      styles.loadMoreText,
                      { fontSize: 14 * textScale },
                      darkMode && styles.loadMoreTextDark,
                    ]}
                  >
                    Load more
                  </Text>
                </Pressable>
              ) : (
                <Text
                  style={[
                    styles.smallNote,
                    { fontSize: 13 * textScale },
                    darkMode && styles.smallNoteDark,
                  ]}
                >
                  No more jokes.
                </Text>
              )}
            </View>
          }
        />
      )}

      {jokePendingDelete && (
        <View style={styles.confirmOverlay}>
          <View
            style={[
              styles.confirmBox,
              darkMode && styles.confirmBoxDark,
            ]}
          >
            <Text
              style={[
                styles.confirmTitle,
                { fontSize: 16 * textScale },
                darkMode && styles.confirmTitleDark,
              ]}
            >
              Are you sure you want to delete this joke?
            </Text>

            <View style={styles.confirmButtons}>
              <Pressable
                style={styles.keepButton}
                onPress={() => setJokePendingDelete(null)}
              >
                <Text
                  style={[
                    styles.keepButtonText,
                    { fontSize: 14 * textScale },
                  ]}
                >
                  Keep It
                </Text>
              </Pressable>

              <Pressable
                style={styles.deleteButton}
                onPress={confirmDelete}
              >
                <Text
                  style={[
                    styles.deleteButtonText,
                    { fontSize: 14 * textScale },
                  ]}
                >
                  Delete
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text
            style={[
              styles.toastText,
              { fontSize: 14 * textScale },
            ]}
          >
            {toastMessage}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#efefef",
    padding: 16,
  },

  screenDark: {
    backgroundColor: "#101010",
  },

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

  backButtonDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  logo: {
    width: 44,
    height: 44,
  },

  backButtonText: {
    fontSize: 15,
    color: "#111",
    fontFamily: "OpenSans_600SemiBold",
  },

  backButtonTextDark: {
    color: "#f3f3f3",
  },

  title: {
    fontSize: 22,
    color: "#111",
    marginBottom: 12,
    fontFamily: "OpenSans_600SemiBold",
  },

  titleDark: {
    color: "#f3f3f3",
  },

  listContent: {
    paddingBottom: 20,
  },

  card: {
    backgroundColor: "#ffffff",
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  cardDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  jokeText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#111",
    fontFamily: "OpenSans_400Regular",
    minHeight: 44,
  },

  jokeTextDark: {
    color: "#f3f3f3",
  },

  infoLine: {
    marginTop: 10,
    fontSize: 13,
    lineHeight: 18,
    color: "#555",
    fontFamily: "OpenSans_500Medium",
  },

  infoLineDark: {
    color: "#bdbdbd",
  },

  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
  },

  iconButton: {
    width: 38,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f3f3f3",
    borderWidth: 1,
    borderColor: "#e3e3e3",
  },

  iconButtonDark: {
    backgroundColor: "#232323",
    borderColor: "#333",
  },

  iconButtonDisabled: {
    opacity: 0.6,
  },

  footer: {
    paddingVertical: 16,
    alignItems: "center",
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
  },

  confirmBoxDark: {
    backgroundColor: "#1b1b1b",
  },

  confirmTitle: {
    fontSize: 16,
    marginBottom: 16,
    fontFamily: "OpenSans_600SemiBold",
    color: "#111",
  },

  confirmTitleDark: {
    color: "#f3f3f3",
  },

  confirmButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  keepButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#2e7d32",
  },

  keepButtonText: {
    color: "#fff",
    fontFamily: "OpenSans_500Medium",
  },

  deleteButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: "#c62828",
  },

  deleteButtonText: {
    color: "#fff",
    fontFamily: "OpenSans_500Medium",
  },

  loadMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  loadMoreButtonDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  loadMoreText: {
    fontSize: 14,
    color: "#222",
    fontFamily: "OpenSans_500Medium",
  },

  loadMoreTextDark: {
    color: "#f3f3f3",
  },

  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  smallNote: {
    fontSize: 13,
    color: "#666",
    fontFamily: "OpenSans_400Regular",
  },

  smallNoteDark: {
    color: "#bdbdbd",
  },

  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    color: "#444",
    fontFamily: "OpenSans_400Regular",
  },

  emptyTextDark: {
    color: "#c7c7c7",
  },

  errorBanner: {
    marginBottom: 12,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff4f4",
    borderWidth: 1,
    borderColor: "#ffd2d2",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  errorBannerDark: {
    backgroundColor: "#2a1616",
    borderColor: "#5a2a2a",
  },

  errorText: {
    color: "#a40000",
    flex: 1,
    paddingRight: 10,
    fontFamily: "OpenSans_400Regular",
  },

  errorTextDark: {
    color: "#ffb3b3",
  },

  retryText: {
    color: "#222",
    textDecorationLine: "underline",
    fontFamily: "OpenSans_500Medium",
  },

  retryTextDark: {
    color: "#f3f3f3",
  },

  toastContainer: {
    position: "absolute",
    bottom: 30,
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },

  toastText: {
    color: "#fff",
    fontSize: 14,
    fontFamily: "OpenSans_500Medium",
  },
});