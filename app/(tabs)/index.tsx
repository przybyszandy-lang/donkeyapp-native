// app/(tabs)/index.tsx
import { useIsFocused } from "@react-navigation/native";
import { Image } from "expo-image";
import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  Share,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  DeviceEventEmitter,
} from "react-native";
import { Gesture, GestureDetector, GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";

import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

import {
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/open-sans";

import FeedAdSlot from "../../components/FeedAdSlot";
import ReelViewer from "../../components/ReelViewer";
import VideoCard from "../../components/VideoCard";
import { FAVOURITES_CHANGED_EVENT, VOTES_CHANGED_EVENT } from "../../lib/jokeActions";
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
  average: number;
  display_name: string;
  user_id: string | null;
  isRecentlyAdded?: boolean;
  isAd?: boolean;
};

export default function HomeScreen() {
  const [recentJokes, setRecentJokes] = useState<JokeRow[]>([]);
  const [jokes, setJokes] = useState<JokeRow[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [copiedJokeId, setCopiedJokeId] = useState<string | null>(null);

  const FAVOURITES_KEY = "donkey:favourites:v1";
  const VOTES_KEY = "donkey:votes:v1";
  const LANGUAGE_TUTORIAL_KEY = "donkey:language-tutorial-seen:v1";

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportJokeId, setReportJokeId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const [votesByJokeId, setVotesByJokeId] = useState<Record<string, "bad" | "meh" | "good" | "great">>({});
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [languageTutorialOpen, setLanguageTutorialOpen] = useState(false);
  const [menuButtonReady, setMenuButtonReady] = useState(false);
  const [openVoteJokeId, setOpenVoteJokeId] = useState<string | null>(null);

  const [fontsLoaded] = useFonts({
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
  });

  const [cursorCreatedAt, setCursorCreatedAt] = useState<string | null>(null);
  const [cursorId, setCursorId] = useState<string | null>(null);
  const PAGE_SIZE = 20;
  const FETCH_SIZE = 45;
  const RELOAD_THRESHOLD = 10;
  const onEndReachedCalledDuringMomentum = useRef(false);

  const [menuOpen, setMenuOpen] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [jokeLanguage, setJokeLanguage] = useState("English");
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");
  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;
  const [languageReady, setLanguageReady] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authStep, setAuthStep] = useState<"email" | "code" | "displayName">("email");
  const [authEmail, setAuthEmail] = useState("");
  const [authCode, setAuthCode] = useState("");
  const [authDisplayName, setAuthDisplayName] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [memeRatios, setMemeRatios] = useState<Record<string, number>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [reelStart, setReelStart] = useState<ReelVideo | null>(null);
  const [videoSoundOn, setVideoSoundOn] = useVideoSoundSetting();
  const appIsActive = useAppIsActive();
  const { activeVideoId, viewabilityConfigCallbackPairs } = useMostVisibleVideo("home");
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
    const recentCount = Math.min(
      Math.floor(jokes.length / 4),
      recentJokes.length
    );

    const recentPool = recentJokes
      .slice(0, recentCount)
      .map((item) => ({
        ...item,
        isRecentlyAdded: true,
      }));

    const recentIds = new Set(recentPool.map((item) => item.id));
    const normalPool = jokes.filter((item) => !recentIds.has(item.id));

    const mixed: JokeRow[] = [];
    let normalIndex = 0;
    let recentIndex = 0;

    while (normalIndex < normalPool.length) {
      mixed.push(normalPool[normalIndex]);
      normalIndex += 1;

      if (normalIndex % 3 === 0 && recentIndex < recentPool.length) {
        mixed.push(recentPool[recentIndex]);
        recentIndex += 1;
      }
    }

    while (recentIndex < recentPool.length) {
      mixed.push(recentPool[recentIndex]);
      recentIndex += 1;
    }

    if (!ADS_ENABLED) {
      return mixed;
    }

    const withAds: JokeRow[] = [];

    mixed.forEach((item, index) => {
      withAds.push(item);

      if ((index + 1) % 6 === 0) {
        withAds.push({
          id: `ad-${index}`,
          content: "",
          created_at: item.created_at,
          language: item.language,
          average: 0,
          display_name: "",
          user_id: null,
          isAd: true,
        });
      }
    });

    return withAds;
  }, [jokes, recentJokes, ADS_ENABLED]);

  const knownIds = useMemo(() => new Set<string>(), []);
  const addToKnownIds = (rows: JokeRow[]) => {
    rows.forEach((r) => knownIds.add(r.id));
  };

  async function handleCopyJoke(textToCopy: string, jokeId: string) {
    if (!textToCopy || !textToCopy.trim()) return;

    const textWithAttribution =
      textToCopy.trim() +
      `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

    await Clipboard.setStringAsync(textWithAttribution);
  }

  async function handleShareJoke(textToShare: string, jokeId: string) {
    if (!textToShare || !textToShare.trim()) return;

    const shareText =
      textToShare.trim() +
      `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

    try {
      await Share.share({ message: shareText });
    } catch (e) {
      await Clipboard.setStringAsync(shareText);
      setToastMessage("Joke copied. Share it however you want!");
      setTimeout(() => setToastMessage(null), 2500);
    }
  }

  const loadRecentJokes = async () => {
    try {
const { data, error } = await supabase.rpc("get_recent_jokes_with_names_mixed_v2", {
        p_language: jokeLanguage,
        p_limit: PAGE_SIZE,
      });

      if (error) throw error;

      const rows = (data ?? []) as JokeRow[];
      setRecentJokes(rows);
    } catch (e) {
      console.log("Failed to load recent jokes:", e);
      setRecentJokes([]);
    }
  };

  const runSearch = () => {
    const cleanSearch = searchText.trim();

    if (cleanSearch.length === 0) {
      return;
    }

    if (cleanSearch.length < 3) {
      setToastMessage("Please enter at least 3 characters.");
      setTimeout(() => setToastMessage(null), 2500);
      return;
    }

    setSearchQuery(cleanSearch);
    setJokes([]);
    setCursorCreatedAt(null);
    setCursorId(null);
  };

  const loadInitial = async () => {
    setLoadingInitial(true);
    setErrorText(null);

    try {
      const { data, error } = await supabase.rpc("get_jokes_feed_mixed_v2", {
        p_limit: FETCH_SIZE,
        p_after_created_at: null,
        p_after_id: null,
        p_language: jokeLanguage,
        p_search: searchQuery ? searchQuery : null,
      });

      if (error) throw error;

      const rows = (data ?? []) as JokeRow[];

      knownIds.clear();
      addToKnownIds(rows);
      setJokes(rows);
      await loadRecentJokes();

      const last = rows[rows.length - 1];
      setCursorCreatedAt(last ? last.created_at : null);
      setCursorId(last ? last.id : null);
    } catch (e: any) {
      setErrorText(e?.message ?? "Unknown error loading jokes.");
    } finally {
      setLoadingInitial(false);
    }
  };

  const loadMore = async () => {
    if (loadingMore) return;
    if (!cursorCreatedAt || !cursorId) return;

    setLoadingMore(true);
    onEndReachedCalledDuringMomentum.current = true;
    setErrorText(null);

    try {
      const { data, error } = await supabase.rpc("get_jokes_feed_mixed_v2", {
        p_limit: FETCH_SIZE,
        p_after_created_at: cursorCreatedAt,
        p_after_id: cursorId,
        p_language: jokeLanguage,
        p_search: searchQuery ? searchQuery : null,
      });

      if (error) throw error;

      const rowsRaw = (data ?? []) as JokeRow[];
      const rows = rowsRaw.filter((r) => !knownIds.has(r.id));

      addToKnownIds(rows);
      setJokes((prev: JokeRow[]) => [...prev, ...rows]);

      const last = rowsRaw[rowsRaw.length - 1];
      setCursorCreatedAt(last ? last.created_at : null);
      setCursorId(last ? last.id : null);
    } catch (e: any) {
      setErrorText(e?.message ?? "Unknown error loading more jokes.");
    } finally {
      onEndReachedCalledDuringMomentum.current = false;
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (!languageReady) return;
    loadInitial();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, jokeLanguage, languageReady]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
        const parsed = raw ? (JSON.parse(raw) as string[]) : [];
        setFavouriteIds(new Set(parsed));
      } catch (e) {
        console.log("Failed to load favourites:", e);
        setFavouriteIds(new Set());
      }
    })();
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (error) {
        console.log("Get current user failed:", error);
        setCurrentUserId(null);
        return;
      }
      setCurrentUserId(data.user?.id ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUserId(session?.user?.id ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(VOTES_KEY);
        const parsed = raw ? (JSON.parse(raw) as Record<string, "bad" | "meh" | "good" | "great">) : {};
        setVotesByJokeId(parsed);
      } catch (e) {
        console.log("Failed to load votes:", e);
        setVotesByJokeId({});
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const rawLanguage = await AsyncStorage.getItem("donkey:language:v1");
        if (rawLanguage) setJokeLanguage(rawLanguage);

        const rawDark = await AsyncStorage.getItem("donkey:darkmode:v1");
        if (rawDark) setDarkMode(rawDark === "true");

        const rawText = await AsyncStorage.getItem("donkey:textsize:v1");
        if (rawText) setTextSize(rawText as "Small" | "Normal" | "Large");

      } catch (e) {
        console.log("Failed to load settings:", e);
      } finally {
        setLanguageReady(true);
        setMenuButtonReady(true);
      }
    })();
  }, []);

  const isFocused = useIsFocused();

  // Stay in sync with favourites / votes changed inside Reel mode.
  useEffect(() => {
    const favSub = DeviceEventEmitter.addListener(FAVOURITES_CHANGED_EVENT, (ids: string[]) =>
      setFavouriteIds(new Set(ids))
    );
    const voteSub = DeviceEventEmitter.addListener(VOTES_CHANGED_EVENT, (next: Record<string, "bad" | "meh" | "good" | "great">) =>
      setVotesByJokeId(next)
    );
    return () => {
      favSub.remove();
      voteSub.remove();
    };
  }, []);

  useEffect(() => {
    if (!isFocused) return;

    (async () => {
      try {
        const rawFavourites = await AsyncStorage.getItem(FAVOURITES_KEY);
        const parsedFavourites = rawFavourites ? (JSON.parse(rawFavourites) as string[]) : [];
        setFavouriteIds(new Set(parsedFavourites));

        const rawLanguage = await AsyncStorage.getItem("donkey:language:v1");
        if (rawLanguage) setJokeLanguage(rawLanguage);

        const rawDark = await AsyncStorage.getItem("donkey:darkmode:v1");
        if (rawDark) setDarkMode(rawDark === "true");

        const rawText = await AsyncStorage.getItem("donkey:textsize:v1");
        if (rawText) setTextSize(rawText as "Small" | "Normal" | "Large");
      } catch (e) {
        console.log("Failed to refresh Home settings:", e);
      }
    })();
  }, [isFocused]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVOURITES_KEY);
        const parsed = raw ? (JSON.parse(raw) as string[]) : [];
        setFavouriteIds(new Set(parsed));
      } catch (e) {
        console.log("Failed to load favourites:", e);
        setFavouriteIds(new Set());
      }
    })();
  }, []);

  const onPressCopy = async (jokeText: string, jokeId: string) => {
    await handleCopyJoke(jokeText, jokeId);

    setCopiedJokeId(jokeId);
    setToastMessage("Joke copied. Share it however you want!");

    setTimeout(() => {
      setCopiedJokeId(null);
      setToastMessage(null);
    }, 4500);
  };

  const onPressFavourite = async (jokeId: string) => {
    try {
      setFavouriteIds((prev) => {
        const next = new Set(prev);

        if (next.has(jokeId)) {
          next.delete(jokeId);
        } else {
          next.add(jokeId);
        }

        AsyncStorage.setItem(
          FAVOURITES_KEY,
          JSON.stringify(Array.from(next))
        ).catch((e) => console.log("Failed to save favourites:", e));

        return next;
      });
    } catch (e) {
      console.log("Favourite toggle failed:", e);
    }
  };

  const onPressVote = async (
    jokeId: string,
    vote: "bad" | "meh" | "good" | "great"
  ) => {
    if (votesByJokeId[jokeId]) return;

    try {
      const next = { ...votesByJokeId, [jokeId]: vote };
      setVotesByJokeId(next);

      await AsyncStorage.setItem(VOTES_KEY, JSON.stringify(next));

      setOpenVoteJokeId(null);

      const { error } = await supabase.rpc("rate_joke", {
        p_id: jokeId,
        p_vote: vote,
      });

      if (error) {
        console.log("Supabase vote failed:", error);
        setToastMessage("Vote saved locally, but failed to sync.");
        setTimeout(() => setToastMessage(null), 2500);
      }
    } catch (e) {
      console.log("Vote save failed:", e);
      setToastMessage("Vote failed to save. Please try again.");
      setTimeout(() => setToastMessage(null), 2500);
    }
  };

  const renderItem = ({ item }: { item: any }) => {
    if (ADS_ENABLED && item.isAd) {
      return <FeedAdSlot darkMode={darkMode} />;
    }

    const hasVoted = !!votesByJokeId[item.id];
    const myVote = votesByJokeId[item.id];
    const voteIsOpen = openVoteJokeId === item.id;

    const voteEmoji =
      myVote === "bad" ? "😕" :
      myVote === "meh" ? "😐" :
      myVote === "good" ? "🙂" :
      myVote === "great" ? "😂" :
      null;

    return (
      <View
        style={[
          styles.card,
          darkMode && {
            backgroundColor: "#1b1b1b",
            borderColor: "#333",
          },
        ]}
      >
{/* Meme image */}
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
          setMemeRatios((prev) => ({
            ...prev,
            [item.id]: width / height,
          }));
        }
      }}
    />
  </Pressable>
) : null}

        {/* Video */}
        {item.content_type === "video" && item.video_path ? (
          <VideoCard
            jokeId={item.id}
            viewSource="home"
            videoPath={item.video_path}
            posterPath={item.image_path}
            description={item.content}
            active={
              activeVideoId === item.id &&
              isFocused &&
              appIsActive &&
              !reelStart &&
              !menuOpen &&
              !reportModalOpen &&
              !authModalOpen &&
              !zoomImage
            }
            soundOn={videoSoundOn}
            onToggleSound={() => setVideoSoundOn(!videoSoundOn)}
            onOpen={() =>
              setReelStart({
                id: item.id,
                video_path: item.video_path,
                image_path: item.image_path,
                user_id: item.user_id,
                display_name: item.display_name,
                created_at: item.created_at,
                content: item.content,
              })
            }
          />
        ) : null}

        {/* Joke text */}
        <>
          {item.isRecentlyAdded && (
            <Text
              style={[
                styles.jokeText,
                {
                  fontSize: 16 * textScale,
                  lineHeight: 22 * textScale,
                  fontStyle: "italic",
                  marginBottom: 6,
                },
                darkMode && { color: "#7db3ff" },
              ]}
            >
              Recently Added
            </Text>
          )}

          {item.content_type !== "video" ? (
            <Text
              style={[
                styles.jokeText,
                {
                  fontSize: 16 * textScale,
                  lineHeight: 22 * textScale,
                },
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              {item.content}
            </Text>
          ) : null}
        </>

        {item.display_name && item.display_name !== "Anonymous" && item.user_id ? (
          <Text
            style={[
              styles.addedBy,
              { fontSize: 13 * textScale },
              darkMode && { color: "#bdbdbd" },
            ]}
          >
            Added by{" "}
            <Text
              style={[
                styles.addedByLink,
                darkMode && { color: "#7db3ff" },
              ]}
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
              darkMode && { color: "#bdbdbd" },
            ]}
          >
            Added by {item.display_name && item.display_name !== "" ? item.display_name : "Anonymous"}
          </Text>
        )}

{/* Footer: 5 equal sections */}
        <View
          style={[
            styles.cardFooter,
            darkMode && {
              backgroundColor: "#151515",
              borderColor: "#333",
            },
            { overflow: "visible" },
          ]}
        >
          {/* Vote bubble — floats above footer */}
{voteIsOpen && !hasVoted && (
            <View style={styles.voteBubble}>
              <View
                style={[
                  styles.voteBubbleInner,
                  darkMode && styles.voteBubbleDark,
                ]}
              >
              <View style={styles.voteBubbleEmojiRow}>
                <Pressable onPress={() => onPressVote(item.id, "bad")}>
                  <Text style={styles.voteBubbleEmoji}>😕</Text>
                </Pressable>
                <Pressable onPress={() => onPressVote(item.id, "meh")}>
                  <Text style={styles.voteBubbleEmoji}>😐</Text>
                </Pressable>
                <Pressable onPress={() => onPressVote(item.id, "good")}>
                  <Text style={styles.voteBubbleEmoji}>🙂</Text>
                </Pressable>
                <Pressable onPress={() => onPressVote(item.id, "great")}>
                  <Text style={styles.voteBubbleEmoji}>😂</Text>
                </Pressable>
                </View>
              </View>
            </View>
          )}  
                {/* Copy — jokes only */}
          {item.content_type !== "meme" && item.content_type !== "video" && (
            <>
              <Pressable
                style={styles.footerAction}
                onPress={() => onPressCopy(item.content, item.id)}
              >
                <MaterialIcons
                  name={copiedJokeId === item.id ? "check" : "content-copy"}
                  size={22}
                  color={copiedJokeId === item.id ? "#2e7d32" : darkMode ? "#888" : "#444"}
                />
              </Pressable>
              <View style={[styles.footerActionDivider, darkMode && { backgroundColor: "#333" }]} />
            </>
          )}

          {/* Share */}
          <Pressable
            style={styles.footerAction}
            onPress={() =>
              item.content_type === "meme"
                ? handleShareJoke("Check out this meme on Donkey App 😂", item.id)
                : item.content_type === "video"
                ? handleShareJoke("Check out this video on Donkey App 😂", item.id)
                : handleShareJoke(item.content, item.id)
            }
          >
            <MaterialIcons
              name="share"
              size={22}
              color={darkMode ? "#888" : "#444"}
            />
          </Pressable>

          <View style={[styles.footerActionDivider, darkMode && { backgroundColor: "#333" }]} />

          {/* Vote */}
          <Pressable
            style={styles.footerAction}
            onPress={() => {
              if (hasVoted) return;
              setOpenVoteJokeId(voteIsOpen ? null : item.id);
            }}
          >
            <Text style={styles.footerVoteText}>
              {hasVoted ? voteEmoji : "😕😂"}
            </Text>
          </Pressable>

          <View style={[styles.footerActionDivider, darkMode && { backgroundColor: "#333" }]} />

          {/* Report */}
          <Pressable
            style={styles.footerAction}
            onPress={() => {
              if (reportedIds.has(item.id)) {
                setReportedIds((prev) => {
                  const next = new Set(prev);
                  next.delete(item.id);
                  return next;
                });
                return;
              }
              setReportJokeId(item.id);
              setReportModalOpen(true);
            }}
          >
            <MaterialCommunityIcons
              name={reportedIds.has(item.id) ? "flag" : "flag-outline"}
              size={22}
              color={reportedIds.has(item.id) ? "#2f71d3" : darkMode ? "#888" : "#666"}
            />
          </Pressable>

          <View style={[styles.footerActionDivider, darkMode && { backgroundColor: "#333" }]} />

          {/* Favourite */}
          <Pressable
            style={styles.footerAction}
            onPress={() => onPressFavourite(item.id)}
          >
            <MaterialIcons
              name={favouriteIds.has(item.id) ? "favorite" : "favorite-border"}
              size={22}
              color={favouriteIds.has(item.id) ? "#d32f2f" : darkMode ? "#888" : "#444"}
            />
          </Pressable>
        </View>

        {/* COMMENT L: Placeholder for future ad slot insertion (do not remove)
            <View style={styles.adPlaceholder}><Text>Ad</Text></View>
        */}
      </View>
    );
  };

  const TopPanel = () => (
    <View style={[styles.topPanel, darkMode && { backgroundColor: "#101010" }]}>
      <Pressable
        style={styles.topIconArea}
        onPress={() => {
          setMenuOpen(true);
          if (languageTutorialOpen) {
            setLanguageTutorialOpen(false);
            AsyncStorage.setItem(LANGUAGE_TUTORIAL_KEY, "true").catch((e) =>
              console.log("Failed to save language tutorial state:", e)
            );
          }
        }}
      >
        <MaterialIcons
          name="menu"
          size={26}
          color={darkMode ? "#f3f3f3" : "#222"}
        />
      </Pressable>

      <View
        style={[
          styles.searchBox,
          darkMode && {
            backgroundColor: "#1b1b1b",
            borderColor: "#333",
          },
        ]}
      >
        <MaterialIcons name="search" size={20} color={darkMode ? "#bdbdbd" : "#666"} />

        <TextInput
          style={[
            styles.searchInput,
            darkMode && { color: "#f3f3f3" },
          ]}
          placeholder="Search jokes…"
          placeholderTextColor={darkMode ? "#8f8f8f" : "#777"}
          value={searchText}
          onChangeText={(t) => {
            setSearchText(t);
            if (t === "") setSearchQuery("");
          }}
          autoCorrect={false}
          autoCapitalize="none"
          returnKeyType="search"
          blurOnSubmit={false}
          onSubmitEditing={runSearch}
        />

        {searchText !== "" && (
          <Pressable
            onPress={() => {
              setSearchText("");
              setSearchQuery("");
            }}
          >
            <MaterialIcons name="close" size={18} color={darkMode ? "#bdbdbd" : "#666"} />
          </Pressable>
        )}
      </View>

      <Image
        source={require("../../assets/logo.png")}
        style={styles.topLogo}
        resizeMode="contain"
      />
    </View>
  );

  const MenuModal = () => (
    <Modal
  visible={menuOpen}
  transparent
  animationType="none"
  hardwareAccelerated
  statusBarTranslucent
  onRequestClose={() => setMenuOpen(false)}
>
      <Pressable style={styles.modalOverlay} onPress={() => setMenuOpen(false)}>
        <Pressable
          style={[
            styles.modalSheet,
            darkMode && {
              backgroundColor: "#1b1b1b",
              borderColor: "#333",
            },
          ]}
          onPress={() => {}}
        >
          <Text
            style={[
              styles.modalTitle,
              darkMode && { color: "#f3f3f3" },
            ]}
          >
            Menu
          </Text>

          <Pressable
            style={styles.modalItem}
            onPress={() => {
              setMenuOpen(false);
              router.push("/(tabs)/add-joke");
            }}
          >
            <Text
              style={[
                styles.modalItemText,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              Add a Joke
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modalItem,
              darkMode && { borderTopColor: "#333" },
            ]}
            onPress={() => {
              setMenuOpen(false);
              if (currentUserId) {
                router.push("/(tabs)/my-jokes");
              } else {
                setAuthStep("email");
                setAuthModalOpen(true);
              }
            }}
          >
            <Text
              style={[
                styles.modalItemText,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              My Jokes
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modalItem,
              darkMode && { borderTopColor: "#333" },
            ]}
            onPress={async () => {
              setMenuOpen(false);

              if (currentUserId) {
                const { error } = await supabase.auth.signOut();

                if (error) {
                  console.log("Sign out failed:", error);
                  setToastMessage("Failed to sign out.");
                  setTimeout(() => setToastMessage(null), 2500);
                  return;
                }

                setToastMessage("Signed out.");
                setTimeout(() => setToastMessage(null), 2500);
                return;
              }

              setAuthStep("email");
              setAuthModalOpen(true);
            }}
          >
            <Text
              style={[
                styles.modalItemText,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              {currentUserId ? "Sign Out" : "Sign In / Up"}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modalItem,
              darkMode && { borderTopColor: "#333" },
            ]}
            onPress={() => {
              setMenuOpen(false);
              router.push("/(tabs)/settings");
            }}
          >
            <Text
              style={[
                styles.modalItemText,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              Settings
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.modalItem,
              styles.modalClose,
              darkMode && {
                borderTopColor: "#333",
                backgroundColor: "#2a2a2a",
              },
            ]}
            onPress={() => setMenuOpen(false)}
          >
            <Text
              style={[
                styles.modalItemText,
                styles.modalCloseText,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              Close
            </Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const LanguageTutorialModal = () => (
    <Modal visible={languageTutorialOpen && menuButtonReady} transparent animationType="fade">
      <View style={styles.tutorialOverlay}>
        <View style={styles.tutorialTopRow}>
          <View
            style={[
              styles.tutorialBubble,
              darkMode && {
                backgroundColor: "#1b1b1b",
                borderColor: "#333",
              },
            ]}
          >
            <Text
              style={[
                styles.tutorialTitle,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              Change joke language here
            </Text>

            <Text
              style={[
                styles.tutorialText,
                darkMode && { color: "#bdbdbd" },
              ]}
            >
              Tap the three bars in the top-left corner, then open Settings to choose your joke language.
            </Text>

            <Pressable
              style={styles.tutorialButton}
              onPress={async () => {
                setLanguageTutorialOpen(false);
                try {
                  await AsyncStorage.setItem(LANGUAGE_TUTORIAL_KEY, "true");
                } catch (e) {
                  console.log("Failed to save language tutorial state:", e);
                }
              }}
            >
              <Text style={styles.tutorialButtonText}>Got it</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );

  const ReportModal = () => (
    <Modal visible={reportModalOpen} transparent animationType="fade">
      <Pressable
        style={styles.modalOverlay}
        onPress={() => {
          setReportModalOpen(false);
          setReportReason(null);
        }}
      >
        <Pressable
          style={[
            styles.modalSheet,
            darkMode && {
              backgroundColor: "#1b1b1b",
              borderColor: "#333",
            },
          ]}
          onPress={() => {}}
        >
          <Text
            style={[
              styles.modalTitle,
              darkMode && { color: "#f3f3f3" },
            ]}
          >
            Report joke
          </Text>

          <Pressable
            style={styles.modalItem}
            onPress={() => setReportReason("offensive")}
          >
            <View style={styles.reportRow}>
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                This jokes appears to be offensive
              </Text>
              {reportReason === "offensive" && (
                <MaterialIcons name="check" size={20} color="#2e7d32" />
              )}
            </View>
          </Pressable>

          <Pressable
            style={styles.modalItem}
            onPress={() => setReportReason("illegal")}
          >
            <View style={styles.reportRow}>
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                The joke is clearly illeagal!
              </Text>
              {reportReason === "illegal" && (
                <MaterialIcons name="check" size={20} color="#2e7d32" />
              )}
            </View>
          </Pressable>

          <Pressable
            style={styles.modalItem}
            onPress={() => setReportReason("other")}
          >
            <View style={styles.reportRow}>
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                Other
              </Text>
              {reportReason === "other" && (
                <MaterialIcons name="check" size={20} color="#2e7d32" />
              )}
            </View>
          </Pressable>

          <View
            style={[
              styles.reportDivider,
              darkMode && { backgroundColor: "#333" },
            ]}
          />

          <View style={styles.reportButtons}>
            <Pressable
              style={[
                styles.reportButton,
                !reportReason && styles.reportButtonDisabled,
              ]}
              onPress={async () => {
                if (!reportReason || !reportJokeId) return;

                const { error } = await supabase.rpc("report_joke", {
                  p_joke_id: reportJokeId,
                  p_reason: reportReason,
                });

                if (error) {
                  console.log("Report failed:", error);
                  setToastMessage("Report failed. Please try again.");
                  setTimeout(() => setToastMessage(null), 2500);
                  return;
                }

                setReportedIds((prev) => new Set(prev).add(reportJokeId));
                setReportModalOpen(false);
                setReportReason(null);
                setReportJokeId(null);
                setToastMessage("Thank you. Report submitted.");
                setTimeout(() => setToastMessage(null), 2500);
              }}
            >
              <Text style={styles.reportButtonText}>Report</Text>
            </Pressable>

            <Pressable
              style={[
                styles.reportCancelButton,
                darkMode && {
                  backgroundColor: "#2a2a2a",
                },
              ]}
              onPress={() => {
                setReportModalOpen(false);
                setReportReason(null);
              }}
            >
              <Text
                style={[
                  styles.reportCancelText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                Close
              </Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );

  const AuthModal = () => (
    <Modal visible={authModalOpen} transparent animationType="fade">
      <Pressable
        style={styles.modalOverlay}
        onPress={() => {
          setAuthModalOpen(false);
          setAuthStep("email");
          setAuthCode("");
        }}
      >
        <Pressable
          style={[
            styles.modalSheet,
            darkMode && {
              backgroundColor: "#1b1b1b",
              borderColor: "#333",
            },
          ]}
          onPress={() => {}}
        >
          <Text style={[styles.modalTitle, darkMode && { color: "#f3f3f3" }]}>
            {authStep === "email"
              ? "Log in or sign up"
              : authStep === "code"
              ? "Enter your code"
              : "Choose display name"}
          </Text>

          {authStep === "email" && (
            <>
              <Text style={styles.authHelpText}>
                Enter your email to receive a one-time code.
              </Text>

              <TextInput
                style={[
                  styles.authInput,
                  darkMode && {
                    backgroundColor: "#1b1b1b",
                    borderColor: "#333",
                    color: "#f3f3f3",
                  },
                ]}
                placeholder="Email address"
                placeholderTextColor={darkMode ? "#8f8f8f" : "#777"}
                value={authEmail}
                onChangeText={setAuthEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
              />

              <Pressable
                style={[
                  styles.authPrimaryButton,
                  (!authEmail.trim() || authBusy) && styles.reportButtonDisabled,
                ]}
                onPress={async () => {
                  const cleanEmail = authEmail.trim().toLowerCase();
                  if (!cleanEmail || authBusy) return;

                  try {
                    setAuthBusy(true);

                    const { error } = await supabase.auth.signInWithOtp({
                      email: cleanEmail,
                    });

                    if (error) {
                      console.log("Send code failed:", error);
                      setToastMessage(error.message || "Failed to send code.");
                      setTimeout(() => setToastMessage(null), 2500);
                      return;
                    }

                    setAuthEmail(cleanEmail);
                    setAuthStep("code");
                    setToastMessage("Code sent to your email.");
                    setTimeout(() => setToastMessage(null), 2500);
                  } catch (e) {
                    console.log("Send code failed:", e);
                    setToastMessage("Failed to send code.");
                    setTimeout(() => setToastMessage(null), 2500);
                  } finally {
                    setAuthBusy(false);
                  }
                }}
              >
                <Text style={styles.authPrimaryButtonText}>
                  {authBusy ? "Sending..." : "Continue"}
                </Text>
              </Pressable>
            </>
          )}

          {authStep === "code" && (
            <>
              <Text style={styles.authHelpText}>
                Enter the code sent to your email.
              </Text>

              <TextInput
                style={[
                  styles.authInput,
                  darkMode && {
                    backgroundColor: "#1b1b1b",
                    borderColor: "#333",
                    color: "#f3f3f3",
                  },
                ]}
                placeholder="One-time code"
                placeholderTextColor={darkMode ? "#8f8f8f" : "#777"}
                value={authCode}
                onChangeText={setAuthCode}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="number-pad"
              />

              <View style={styles.authButtonRow}>
                <Pressable
                  style={styles.reportCancelButton}
                  onPress={() => setAuthStep("email")}
                >
                  <Text style={styles.reportCancelText}>Back</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.reportButton,
                    (!authCode.trim() || authBusy) && styles.reportButtonDisabled,
                  ]}
                  onPress={async () => {
                    const cleanCode = authCode.trim();
                    const cleanEmail = authEmail.trim().toLowerCase();

                    if (!cleanCode || !cleanEmail || authBusy) return;

                    try {
                      setAuthBusy(true);

                      const { data, error } = await supabase.auth.verifyOtp({
                        email: cleanEmail,
                        token: cleanCode,
                        type: "email",
                      });

                      if (error) {
                        console.log("Verify code failed:", error);
                        setToastMessage(error.message || "Invalid code.");
                        setTimeout(() => setToastMessage(null), 2500);
                        return;
                      }

                      const userId = data.user?.id;

                      if (!userId) {
                        setToastMessage("Login succeeded, but user was not returned.");
                        setTimeout(() => setToastMessage(null), 2500);
                        return;
                      }

                      const { data: profileRow, error: profileError } = await supabase
                        .from("profiles")
                        .select("display_name")
                        .eq("id", userId)
                        .maybeSingle();

                      if (profileError) {
                        console.log("Profile lookup failed:", profileError);
                        setToastMessage("Logged in, but failed to load profile.");
                        setTimeout(() => setToastMessage(null), 2500);
                        return;
                      }

                      if (profileRow?.display_name && profileRow.display_name.trim() !== "") {
                        setAuthModalOpen(false);
                        setAuthStep("email");
                        setAuthCode("");
                        setAuthDisplayName("");
                        setMenuOpen(false);
                        setToastMessage("Logged in successfully.");
                        setTimeout(() => setToastMessage(null), 2500);
                      } else {
                        setAuthStep("displayName");
                      }
                    } catch (e) {
                      console.log("Verify code failed:", e);
                      setToastMessage("Failed to verify code.");
                      setTimeout(() => setToastMessage(null), 2500);
                    } finally {
                      setAuthBusy(false);
                    }
                  }}
                >
                  <Text style={styles.reportButtonText}>
                    {authBusy ? "Checking..." : "Continue"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {authStep === "displayName" && (
            <>
              <Text style={styles.authHelpText}>
                Choose the display name other users will see.
              </Text>

              <TextInput
                style={[
                  styles.authInput,
                  darkMode && {
                    backgroundColor: "#1b1b1b",
                    borderColor: "#333",
                    color: "#f3f3f3",
                  },
                ]}
                placeholder="Display name"
                placeholderTextColor={darkMode ? "#8f8f8f" : "#777"}
                value={authDisplayName}
                onChangeText={setAuthDisplayName}
                autoCorrect={false}
              />

              <View style={styles.authButtonRow}>
                <Pressable
                  style={styles.reportCancelButton}
                  onPress={() => setAuthStep("code")}
                >
                  <Text style={styles.reportCancelText}>Back</Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.reportButton,
                    (!authDisplayName.trim() || authBusy) && styles.reportButtonDisabled,
                  ]}
                  onPress={async () => {
                    const cleanDisplayName = authDisplayName.trim();

                    if (!cleanDisplayName || authBusy) return;

                    try {
                      setAuthBusy(true);

                      const {
                        data: { user },
                        error: userError,
                      } = await supabase.auth.getUser();

                      if (userError || !user) {
                        console.log("Get user failed:", userError);
                        setToastMessage("Could not find logged in user.");
                        setTimeout(() => setToastMessage(null), 5000);
                        return;
                      }

                      const { data: existingProfile, error: existingProfileError } = await supabase
                        .from("profiles")
                        .select("id")
                        .eq("id", user.id)
                        .maybeSingle();

                      if (existingProfileError) {
                        console.log("Profile check failed:", existingProfileError);
                        setToastMessage("Failed to save display name.");
                        setTimeout(() => setToastMessage(null), 5000);
                        return;
                      }

                      let saveError = null;

                      if (existingProfile) {
                        const { error } = await supabase
                          .from("profiles")
                          .update({
                            email: user.email ?? authEmail.trim().toLowerCase(),
                            display_name: cleanDisplayName,
                            updated_at: new Date().toISOString(),
                          })
                          .eq("id", user.id);

                        saveError = error;
                      } else {
                        const { error } = await supabase
                          .from("profiles")
                          .insert({
                            id: user.id,
                            email: user.email ?? authEmail.trim().toLowerCase(),
                            display_name: cleanDisplayName,
                            updated_at: new Date().toISOString(),
                          });

                        saveError = error;
                      }

                      if (saveError) {
                        console.log("Save profile failed:", saveError);

                        if ((saveError as any)?.code === "23505") {
                          setToastMessage("Display name already in use. Please choose another one.");
                        } else {
                          setToastMessage("Failed to save display name.");
                        }

                        setTimeout(() => setToastMessage(null), 5000);
                        return;
                      }

                      setAuthModalOpen(false);
                      setAuthStep("email");
                      setAuthCode("");
                      setAuthDisplayName("");
                      setMenuOpen(false);
                      setToastMessage("Profile created. Logged in successfully.");
                      setTimeout(() => setToastMessage(null), 5000);
                    } catch (e) {
                      console.log("Save profile failed:", e);
                      setToastMessage("Failed to save display name.");
                      setTimeout(() => setToastMessage(null), 5000);
                    } finally {
                      setAuthBusy(false);
                    }
                  }}
                >
                  <Text style={styles.reportButtonText}>
                    {authBusy ? "Saving..." : "Finish"}
                  </Text>
                </Pressable>
              </View>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );

  if (!fontsLoaded) {
    return (
      <View style={[styles.screen, darkMode && { backgroundColor: "#101010" }]}>
        {TopPanel()}
        <View style={styles.centerBox}>
          <Image
            source={require("../../assets/logo.png")}
            style={styles.loadingLogo}
            resizeMode="contain"
          />
          <ActivityIndicator />
          <Text style={styles.smallNote}>Loading…</Text>
        </View>
      </View>
    );
  }

  if (loadingInitial) {
    return (
      <View style={[styles.screen, darkMode && { backgroundColor: "#101010" }]}>
        {TopPanel()}
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text style={styles.smallNote}>Loading jokes…</Text>
        </View>

        {toastMessage && (
          <View style={styles.toastContainer}>
            <Text style={styles.toastText}>{toastMessage}</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.screen, darkMode && { backgroundColor: "#101010" }]}>
      {TopPanel()}
      {MenuModal()}
      {ReportModal()}
      {AuthModal()}
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

      {errorText ? (
        <View style={styles.errorBanner}>
          <Text style={styles.errorText}>{errorText}</Text>
          <TouchableOpacity onPress={loadInitial}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={finalFeed}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        onEndReachedThreshold={RELOAD_THRESHOLD / FETCH_SIZE}
        showsVerticalScrollIndicator={false}
        maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
removeClippedSubviews={false}
        viewabilityConfigCallbackPairs={viewabilityConfigCallbackPairs}
        onMomentumScrollBegin={() => {
          onEndReachedCalledDuringMomentum.current = false;
        }}
        onEndReached={() => {
          if (!onEndReachedCalledDuringMomentum.current) {
            loadMore();
            onEndReachedCalledDuringMomentum.current = true;
          }
        }}
        ListFooterComponent={
          <View style={styles.footer}>
            {loadingMore ? (
              <ActivityIndicator />
            ) : cursorCreatedAt ? (
              <TouchableOpacity style={styles.loadMoreButton} onPress={loadMore}>
                <Text style={styles.loadMoreText}>Load more</Text>
              </TouchableOpacity>
            ) : (
              <Text style={styles.smallNote}>No more jokes.</Text>
            )}
          </View>
        }
      />

      <ReelViewer
        startVideo={reelStart}
        language={jokeLanguage}
        onClose={() => setReelStart(null)}
      />

      {toastMessage && (
        <View style={styles.toastContainer}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#efefef",
  },

  topPanel: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    backgroundColor: "#efefef",
  },

  topIconArea: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  tutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.30)",
    justifyContent: "flex-start",
  },

  tutorialTopRow: {
    paddingTop: 8,
    paddingHorizontal: 12,
  },

  tutorialBubble: {
    marginTop: 54,
    width: 320,
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  tutorialTitle: {
    fontSize: 16,
    color: "#111",
    marginBottom: 8,
    fontFamily: "OpenSans_600SemiBold",
  },

  tutorialText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#555",
    fontFamily: "OpenSans_400Regular",
  },

  tutorialButton: {
    marginTop: 12,
    alignSelf: "flex-start",
    backgroundColor: "#2f71d3",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
  },

  tutorialButtonText: {
    color: "#fff",
    fontFamily: "OpenSans_600SemiBold",
  },

  searchBox: {
    flex: 1,
    height: 40,
    marginHorizontal: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: "#222",
    fontFamily: "OpenSans_400Regular",
  },

  topLogo: {
    width: 38,
    height: 38,
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

  jokeText: {
    fontSize: 16,
    lineHeight: 22,
    color: "#111",
    fontFamily: "OpenSans_400Regular",
  },

  addedBy: {
    marginTop: 6,
    fontSize: 13,
    color: "#666",
    fontFamily: "OpenSans_400Regular",
  },

  addedByLink: {
    color: "#2f71d3",
    fontFamily: "OpenSans_600SemiBold",
  },

  cardFooter: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fafafa",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e6e6e6",
    overflow: "hidden",
  },

  footerAction: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  footerActionDivider: {
    width: 1,
    height: 28,
    backgroundColor: "#e0e0e0",
  },

  footerVoteText: {
    fontSize: 18,
    textAlign: "center",
  },

voteBubble: {
    position: "absolute",
    bottom: "100%",
    marginBottom: 6,
    left: 0,
    right: 0,
    alignItems: "center",
    backgroundColor: "transparent",
    zIndex: 10,
  },

voteBubbleInner: {
    backgroundColor: "#fff",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e2e2e2",
    paddingHorizontal: 12,
    paddingVertical: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
  },

  voteBubbleDark: {
    backgroundColor: "#1b1b1b",
    borderColor: "#333",
  },

  voteBubbleEmojiRow: {
    flexDirection: "row",
    gap: 16,
    alignItems: "center",
  },

  voteBubbleEmoji: {
    fontSize: 32,
  },

  copyMessage: {
    marginTop: 8,
    fontSize: 13,
    color: "#2e7d32",
    fontFamily: "OpenSans_500Medium",
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
    fontFamily: "OpenSans_500Medium",
  },

  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  reportButtons: {
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },

  reportButton: {
    flex: 1,
    backgroundColor: "#2f71d3",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginRight: 6,
  },

  reportButtonDisabled: {
    backgroundColor: "#ccc",
  },

  reportButtonText: {
    color: "#fff",
    fontFamily: "OpenSans_600SemiBold",
  },

  reportCancelButton: {
    flex: 1,
    backgroundColor: "#eee",
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: "center",
    marginLeft: 6,
  },

  reportCancelText: {
    color: "#333",
    fontFamily: "OpenSans_600SemiBold",
  },

  authHelpText: {
    fontSize: 14,
    color: "#555",
    marginBottom: 12,
    fontFamily: "OpenSans_400Regular",
  },

  authInput: {
    height: 44,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 12,
    backgroundColor: "#fff",
    color: "#222",
    marginBottom: 12,
    fontFamily: "OpenSans_400Regular",
  },

  authButtonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },

  authPrimaryButton: {
    backgroundColor: "#2f71d3",
    minHeight: 48,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },

  authPrimaryButtonText: {
    color: "#fff",
    fontFamily: "OpenSans_600SemiBold",
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

  footer: {
    paddingVertical: 16,
    alignItems: "center",
  },

  loadMoreButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ddd",
  },

  loadMoreText: {
    fontSize: 14,
    color: "#222",
    fontFamily: "OpenSans_500Medium",
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

  loadingLogo: {
    width: 70,
    height: 70,
    marginBottom: 10,
  },

  errorBanner: {
    marginHorizontal: 12,
    marginBottom: 8,
    padding: 10,
    borderRadius: 12,
    backgroundColor: "#fff4f4",
    borderWidth: 1,
    borderColor: "#ffd2d2",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  errorText: {
    color: "#a40000",
    flex: 1,
    paddingRight: 10,
    fontFamily: "OpenSans_400Regular",
  },

  retryText: {
    color: "#222",
    textDecorationLine: "underline",
    fontFamily: "OpenSans_500Medium",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.30)",
    justifyContent: "flex-start",
    paddingTop: 60,
    paddingHorizontal: 12,
  },

  reportDivider: {
    height: 1,
    backgroundColor: "#ddd",
    marginTop: 8,
    marginBottom: 4,
  },

  modalSheet: {
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  modalTitle: {
    fontSize: 16,
    marginBottom: 10,
    color: "#111",
    fontFamily: "OpenSans_600SemiBold",
  },

  modalItem: {
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },

  modalItemText: {
    fontSize: 15,
    color: "#222",
    fontFamily: "OpenSans_400Regular",
  },

  modalClose: {
    marginTop: 6,
  },

  modalCloseText: {
    fontFamily: "OpenSans_600SemiBold",
  },
});