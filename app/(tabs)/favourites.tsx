// Path: app/(tabs)/favourites.tsx

import { Image } from "expo-image";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";
import { useIsFocused } from "@react-navigation/native";
import { router, useFocusEffect } from "expo-router";

import FeedAdSlot from "../../components/FeedAdSlot";
import ReelViewer from "../../components/ReelViewer";
import VideoCard from "../../components/VideoCard";
import { FAVOURITES_CHANGED_EVENT } from "../../lib/jokeActions";
import { supabase } from "../../lib/supabase";
import {
  ReelVideo,
  useAppIsActive,
  useMostVisibleVideo,
  useVideoSoundSetting,
} from "../../lib/video";

type JokeRow = {
  id: string;
  content: string;
  content_type?: string;
  image_path?: string | null;
  video_path?: string | null;
  created_at: string;
  language: string;
  user_id: string | null;
  display_name: string;
  isAd?: boolean;
};

export default function FavouritesScreen() {
  const FAVOURITES_KEY = "donkey:favourites:v1";
  const DARK_MODE_KEY = "donkey:darkmode:v1";
  const TEXT_SIZE_KEY = "donkey:textsize:v1";

  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [favouriteJokes, setFavouriteJokes] = useState<JokeRow[]>([]);
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedJokeId, setCopiedJokeId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");
  const [memeRatios, setMemeRatios] = useState<Record<string, number>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [reelStart, setReelStart] = useState<ReelVideo | null>(null);
  const [jokeLanguage, setJokeLanguage] = useState("English");
  const [videoSoundOn, setVideoSoundOn] = useVideoSoundSetting();
  const appIsActive = useAppIsActive();
  const isFocused = useIsFocused();
  const { activeVideoId, viewabilityConfigCallbackPairs } = useMostVisibleVideo("favourites");

  // Stay in sync with favourites changed inside Reel mode.
  const favouriteJokesRef = useRef<JokeRow[]>([]);
  useEffect(() => {
    favouriteJokesRef.current = favouriteJokes;
  }, [favouriteJokes]);
  useEffect(() => {
    const favSub = DeviceEventEmitter.addListener(FAVOURITES_CHANGED_EVENT, (ids: string[]) => {
      setFavouriteIds(ids);
      const idSet = new Set(ids);
      setRemovedIds(
        new Set(favouriteJokesRef.current.filter((j) => !idSet.has(j.id)).map((j) => j.id))
      );
    });
    return () => favSub.remove();
  }, []);
  const zoomScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const zoomAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: zoomScale.value },
    ],
  }));
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => { zoomScale.value = Math.max(1, Math.min(4, e.scale)); })
    .onEnd(() => {
      zoomScale.value = withSpring(1);
      translateX.value = withSpring(0);
      translateY.value = withSpring(0);
    });
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      translateX.value = e.translationX;
      translateY.value = e.translationY;
    })
    .onEnd(() => {
      if (zoomScale.value <= 1) {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });
  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGesture);
  const ADS_ENABLED = true;

  const finalFeed = useMemo(() => {
    if (!ADS_ENABLED) {
      return favouriteJokes;
    }

    const withAds: JokeRow[] = [];

    favouriteJokes.forEach((item, index) => {
      withAds.push(item);

      if ((index + 1) % 7 === 0) {
        withAds.push({
          id: `ad-${index}`,
          content: "",
          created_at: item.created_at,
          language: item.language,
          user_id: null,
          display_name: "",
          isAd: true,
        });
      }
    });

    return withAds;
  }, [favouriteJokes]);

  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;

  const loadFavouriteIds = async () => {
    try {
      const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
      const parsed = raw ? (JSON.parse(raw) as string[]) : [];
      setFavouriteIds(parsed);
      return parsed;
    } catch (e) {
      console.log("Failed to load favourites:", e);
      setFavouriteIds([]);
      return [];
    }
  };

  const loadAppearanceSettings = async () => {
    try {
      const rawDark = await AsyncStorage.getItem(DARK_MODE_KEY);
      const rawText = await AsyncStorage.getItem(TEXT_SIZE_KEY);
      const rawLanguage = await AsyncStorage.getItem("donkey:language:v1");

      setDarkMode(rawDark === "true");
      if (rawLanguage) setJokeLanguage(rawLanguage);

      if (rawText === "Small" || rawText === "Normal" || rawText === "Large") {
        setTextSize(rawText);
        return rawText;
      }

      setTextSize("Normal");
      return "Normal";
    } catch (e) {
      console.log("Failed to load appearance settings:", e);
      setDarkMode(false);
      setTextSize("Normal");
      return "Normal";
    }
  };

  const loadFavouriteJokes = async () => {
    setLoading(true);
    setErrorText(null);

    try {
      await loadAppearanceSettings();
      const ids = await loadFavouriteIds();

      if (!ids.length) {
        setFavouriteJokes([]);
        setRemovedIds(new Set());
        return;
      }

      setRemovedIds((prev) => {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      });

      const { data, error } = await supabase.rpc("get_favourite_jokes_with_names_mixed_v2", {
        p_ids: ids,
      });

      if (error) throw error;

      setFavouriteJokes((data ?? []) as JokeRow[]);
    } catch (e: any) {
      setErrorText(e?.message ?? "Failed to load favourites.");
      setFavouriteJokes([]);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFavouriteJokes();
    }, [])
  );

  const copyJoke = async (text: string, jokeId: string) => {
    try {
      const textWithAttribution =
        text.trim() +
        `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

      await Clipboard.setStringAsync(textWithAttribution);

      setCopiedJokeId(jokeId);
      setToastMessage("Joke copied. Share it however you want!");

      setTimeout(() => {
        setCopiedJokeId(null);
        setToastMessage(null);
      }, 3000);
    } catch (e) {
      console.log("Copy failed:", e);
    }
  };

  const handleShareJoke = async (text: string, jokeId: string) => {
    if (!text || !text.trim()) return;

    const shareText =
      text.trim() +
      `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

    try {
      await Share.share({ message: shareText });
    } catch (e) {
      await Clipboard.setStringAsync(shareText);
      setToastMessage("Joke copied. Share it however you want!");
      setTimeout(() => setToastMessage(null), 3000);
    }
  };

  const toggleFavourite = async (jokeId: string, isRemoved: boolean) => {
    try {
      if (isRemoved) {
        const nextIds = Array.from(new Set([...favouriteIds, jokeId]));
        setFavouriteIds(nextIds);

        await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(nextIds));

        setRemovedIds((prev) => {
          const next = new Set(prev);
          next.delete(jokeId);
          return next;
        });

        return;
      }

      const nextIds = favouriteIds.filter((id) => id !== jokeId);

      setFavouriteIds(nextIds);

      await AsyncStorage.setItem(FAVOURITES_KEY, JSON.stringify(nextIds));

      setRemovedIds((prev) => {
        const next = new Set(prev);
        next.add(jokeId);
        return next;
      });
    } catch (e) {
      console.log("Favourite toggle failed:", e);
    }
  };

  const renderItem = ({ item }: { item: JokeRow }) => {
    if (item.isAd) {
      return <FeedAdSlot darkMode={darkMode} />;
    }
    const isRemoved = removedIds.has(item.id);

    return (
      <View
        style={[
          styles.card,
          darkMode && styles.cardDark,
          isRemoved ? { opacity: 0.45 } : null,
        ]}
      >
{item.content_type === "meme" && item.image_path ? (
          <Pressable onPress={() => setZoomImage(`https://mknsvxajrvdlwqywvlrf.supabase.co/storage/v1/object/public/memes/${item.image_path}`)}>
            <Image
              source={{
                uri: `https://mknsvxajrvdlwqywvlrf.supabase.co/storage/v1/object/public/memes/${item.image_path}`,
              }}
              style={{
                width: "100%",
                aspectRatio: memeRatios[item.id] ?? 1,
                borderRadius: 10,
                marginBottom: 10,
              }}
              contentFit="contain"
              onLoad={(e) => {
                const { width, height } = e.source;
                if (width && height) {
                  setMemeRatios((prev) => ({ ...prev, [item.id]: width / height }));
                }
              }}
            />
          </Pressable>
        ) : null}

        {item.content_type === "video" && item.video_path ? (
          <VideoCard
            jokeId={item.id}
            viewSource="favourites"
            videoPath={item.video_path}
            posterPath={item.image_path}
            description={item.content}
            active={activeVideoId === item.id && isFocused && appIsActive && !reelStart && !zoomImage}
            soundOn={videoSoundOn}
            onToggleSound={() => setVideoSoundOn(!videoSoundOn)}
            onOpen={() =>
              setReelStart({
                id: item.id,
                video_path: item.video_path as string,
                image_path: item.image_path,
                user_id: item.user_id,
                display_name: item.display_name,
                created_at: item.created_at,
                content: item.content,
              })
            }
          />
        ) : null}

        {item.content_type !== "video" ? (
          <Text
            style={[
              styles.jokeText,
              {
                fontSize: 16 * textScale,
                lineHeight: 22 * textScale,
              },
              darkMode && styles.jokeTextDark,
            ]}
          >
            {item.content}
          </Text>
        ) : null}

        {item.display_name && item.display_name !== "Anonymous" && item.user_id ? (
          <Text
            style={[
              styles.addedBy,
              { fontSize: 13 * textScale },
              darkMode && styles.addedByDark,
            ]}
          >
            Added by{" "}
            <Text
              style={styles.addedByLink}
              onPress={() =>
                router.push({
                  pathname: "/profile/[userId]",
                  params: { userId: item.user_id ?? "" },
                })
              }
            >
              {item.display_name}
            </Text>
          </Text>
        ) : (
          <Text
            style={[
              styles.addedBy,
              { fontSize: 13 * textScale },
              darkMode && styles.addedByDark,
            ]}
          >
            Added by {item.display_name && item.display_name !== "" ? item.display_name : "Anonymous"}
          </Text>
        )}

        <View
          style={[
            styles.cardFooter,
            darkMode && styles.cardFooterDark,
          ]}
        >
          {item.content_type !== "meme" && item.content_type !== "video" && (
            <Pressable onPress={() => copyJoke(item.content, item.id)}>
              <MaterialIcons
                name={copiedJokeId === item.id ? "check" : "content-copy"}
                size={20}
                color={copiedJokeId === item.id ? "#2e7d32" : darkMode ? "#f3f3f3" : "#333"}
              />
            </Pressable>
          )}

          <Pressable onPress={() =>
            item.content_type === "meme"
              ? handleShareJoke("Check out this meme on Donkey App 😂", item.id)
              : item.content_type === "video"
              ? handleShareJoke("Check out this video on Donkey App 😂", item.id)
              : handleShareJoke(item.content, item.id)
          }>
            <MaterialIcons
              name="share"
              size={20}
              color={darkMode ? "#f3f3f3" : "#333"}
            />
          </Pressable>

          <Pressable onPress={() => toggleFavourite(item.id, isRemoved)}>
            <MaterialIcons
              name={isRemoved ? "favorite-border" : "favorite"}
              size={20}
              color={isRemoved ? "#666" : "#d32f2f"}
            />
          </Pressable>

          <Text
            style={[
              styles.footerText,
              { fontSize: 13 * textScale },
              darkMode && styles.footerTextDark,
            ]}
          >
            Favourite
          </Text>
        </View>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={[styles.screen, darkMode && styles.screenDark]}>
        <TopPanel darkMode={darkMode} textScale={textScale} />
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text
            style={[
              styles.smallNote,
              { fontSize: 13 * textScale },
              darkMode && styles.smallNoteDark,
            ]}
          >
            Loading favourites…
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, darkMode && styles.screenDark]}>
      <TopPanel darkMode={darkMode} textScale={textScale} />

      {errorText && (
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
        </View>
      )}

      {!favouriteJokes.length ? (
        <View style={styles.centerBox}>
          <Text
            style={[
              styles.emptyTitle,
              { fontSize: 16 * textScale },
              darkMode && styles.emptyTitleDark,
            ]}
          >
            No favourites yet
          </Text>
          <Text
            style={[
              styles.smallNote,
              { fontSize: 13 * textScale },
              darkMode && styles.smallNoteDark,
            ]}
          >
            Tap the heart icon on a joke to save it here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={finalFeed}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        />
      )}

      <ReelViewer
        startVideo={reelStart}
        language={jokeLanguage}
        onClose={() => setReelStart(null)}
      />

      <Modal visible={!!zoomImage} transparent animationType="fade" onRequestClose={() => setZoomImage(null)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.95)", justifyContent: "center", alignItems: "center" }}>
            <Pressable style={{ position: "absolute", top: 50, right: 20, zIndex: 10 }} onPress={() => { setZoomImage(null); zoomScale.value = 1; translateX.value = 0; translateY.value = 0; }}>
              <MaterialIcons name="close" size={32} color="#fff" />
            </Pressable>
            <GestureDetector gesture={combinedGesture}>
              <Animated.View style={[{ width: "100%", height: "100%", justifyContent: "center", alignItems: "center" }, zoomAnimatedStyle]}>
                {zoomImage ? (
                  <Image source={{ uri: zoomImage }} style={{ width: "100%", height: "100%" }} contentFit="contain" />
                ) : null}
              </Animated.View>
            </GestureDetector>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

function TopPanel({
  darkMode,
  textScale,
}: {
  darkMode: boolean;
  textScale: number;
}) {
  return (
    <View style={styles.topBar}>
      <Pressable
        style={[
          styles.backButton,
          darkMode && styles.backButtonDark,
        ]}
        onPress={() => router.push("/(tabs)")}
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
        contentFit="contain"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#efefef",
  },

  screenDark: {
    backgroundColor: "#101010",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
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

  backButtonText: {
    fontSize: 15,
    color: "#111",
    fontWeight: "600",
  },

  backButtonTextDark: {
    color: "#f3f3f3",
  },

  logo: {
    width: 38,
    height: 38,
  },

  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111",
  },

  titleDark: {
    color: "#f3f3f3",
  },

  listContent: {
    paddingHorizontal: 12,
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
  },

  jokeTextDark: {
    color: "#f3f3f3",
  },

  addedBy: {
    marginTop: 6,
    fontSize: 13,
    color: "#666",
  },

  addedByDark: {
    color: "#bdbdbd",
  },

  addedByLink: {
    color: "#2f71d3",
    fontWeight: "600",
  },

  cardFooter: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  cardFooterDark: {
    backgroundColor: "#151515",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#333",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  footerText: {
    color: "#444",
    fontSize: 13,
  },

  footerTextDark: {
    color: "#bdbdbd",
  },

  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  smallNote: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
  },

  smallNoteDark: {
    color: "#bdbdbd",
  },

  emptyTitle: {
    fontSize: 16,
    color: "#111",
    fontWeight: "600",
    marginBottom: 6,
  },

  emptyTitleDark: {
    color: "#f3f3f3",
  },

  errorBanner: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff4f4",
    borderWidth: 1,
    borderColor: "#ffd2d2",
    marginHorizontal: 12,
    marginBottom: 10,
  },

  errorBannerDark: {
    backgroundColor: "#2a1616",
    borderColor: "#5a2a2a",
  },

  errorText: {
    color: "#a40000",
  },

  errorTextDark: {
    color: "#ffb3b3",
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
  },
});