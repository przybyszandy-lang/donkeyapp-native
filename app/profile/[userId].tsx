import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Clipboard from "expo-clipboard";

import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

import {
  OpenSans_400Regular,
  OpenSans_500Medium,
  OpenSans_600SemiBold,
  useFonts,
} from "@expo-google-fonts/open-sans";

import { useIsFocused } from "@react-navigation/native";

import FeedAdSlot from "../../components/FeedAdSlot";
import ReelViewer from "../../components/ReelViewer";
import VideoCard from "../../components/VideoCard";
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
  average: number | null;
  user_id: string | null;
  display_name: string;
  isAd?: boolean;
};

type ProfileRow = {
  display_name: string | null;
};

const FAVOURITES_KEY = "donkey:favourites:v1";
const VOTES_KEY = "donkey:votes:v1";
const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";

export default function ProfileScreen() {
  const params = useLocalSearchParams();
  const userId =
    typeof params.userId === "string" ? params.userId : "";

  const [profileName, setProfileName] = useState<string>("User");
  const [jokes, setJokes] = useState<JokeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState<string | null>(null);

  const [copiedJokeId, setCopiedJokeId] = useState<string | null>(null);
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [votesByJokeId, setVotesByJokeId] = useState<
    Record<string, "bad" | "meh" | "good" | "great">
  >({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openVoteJokeId, setOpenVoteJokeId] = useState<string | null>(null);

  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");

  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [reportJokeId, setReportJokeId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());
  const [memeRatios, setMemeRatios] = useState<Record<string, number>>({});
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [reelStart, setReelStart] = useState<ReelVideo | null>(null);
  const [jokeLanguage, setJokeLanguage] = useState("English");
  const [videoSoundOn, setVideoSoundOn] = useVideoSoundSetting();
  const appIsActive = useAppIsActive();
  const isFocused = useIsFocused();
  const { activeVideoId, viewabilityConfig, onViewableItemsChanged } = useMostVisibleVideo();
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
      return jokes;
    }

    const withAds: JokeRow[] = [];

    jokes.forEach((item, index) => {
      withAds.push(item);

      if ((index + 1) % 7 === 0) {
        withAds.push({
          id: `ad-${index}`,
          content: "",
          created_at: item.created_at,
          average: null,
          user_id: null,
          display_name: "",
          isAd: true,
        });
      }
    });

    return withAds;
  }, [jokes]);

  const [fontsLoaded] = useFonts({
    OpenSans_400Regular,
    OpenSans_500Medium,
    OpenSans_600SemiBold,
  });

  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;

  useEffect(() => {
    const loadProfile = async () => {
      if (!userId) {
        setErrorText("No user ID was provided.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorText(null);

      try {
        const { data: jokesData, error: jokesError } = await supabase.rpc(
          "get_profile_jokes_with_name_mixed_v2",
          { p_user_id: userId }
        );

        if (jokesError) {
          throw jokesError;
        }

        const rows = (jokesData ?? []) as JokeRow[];

        setJokes(rows);

        setProfileName(
          rows[0]?.display_name && rows[0].display_name.trim() !== ""
            ? rows[0].display_name
            : "User"
        );
      } catch (e: any) {
        setErrorText(e?.message ?? "Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, [userId]);

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
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(VOTES_KEY);
        const parsed = raw
          ? (JSON.parse(raw) as Record<string, "bad" | "meh" | "good" | "great">)
          : {};
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
        const rawDark = await AsyncStorage.getItem(DARK_MODE_KEY);
        if (rawDark) setDarkMode(rawDark === "true");

        const rawText = await AsyncStorage.getItem(TEXT_SIZE_KEY);
        if (rawText) setTextSize(rawText as "Small" | "Normal" | "Large");

        const rawLanguage = await AsyncStorage.getItem("donkey:language:v1");
        if (rawLanguage) setJokeLanguage(rawLanguage);
      } catch (e) {
        console.log("Failed to load profile screen settings:", e);
      }
    })();
  }, []);

  async function handleCopyJoke(textToCopy: string, jokeId: string) {
    if (!textToCopy || !textToCopy.trim()) return;

    const textWithAttribution =
      textToCopy.trim() +
      `\n\nFound on Donkey App 😂\nhttps://www.donkeyapp.com/joke.html?id=${jokeId}`;

    await Clipboard.setStringAsync(textWithAttribution);
  }

  async function handleShareJoke(text: string, jokeId: string) {
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
  }

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
            style={[
              styles.modalItem,
              darkMode && { borderTopColor: "#333" },
            ]}
            onPress={() => setReportReason("offensive")}
          >
            <View style={styles.reportRow}>
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                This joke is offensive
              </Text>
              {reportReason === "offensive" && (
                <MaterialIcons name="check" size={20} color="#2e7d32" />
              )}
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.modalItem,
              darkMode && { borderTopColor: "#333" },
            ]}
            onPress={() => setReportReason("illegal")}
          >
            <View style={styles.reportRow}>
              <Text
                style={[
                  styles.modalItemText,
                  darkMode && { color: "#f3f3f3" },
                ]}
              >
                This joke is clearly illegal
              </Text>
              {reportReason === "illegal" && (
                <MaterialIcons name="check" size={20} color="#2e7d32" />
              )}
            </View>
          </Pressable>

          <Pressable
            style={[
              styles.modalItem,
              darkMode && { borderTopColor: "#333" },
            ]}
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
                darkMode && { backgroundColor: "#2a2a2a" },
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

  if (!fontsLoaded) {
    return (
      <View style={[styles.screen, darkMode && { backgroundColor: "#101010" }]}>
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text style={styles.smallNote}>Loading…</Text>
        </View>
      </View>
    );
  }

  const renderItem = ({ item }: { item: JokeRow }) => {
    if (item.isAd) {
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
            videoPath={item.video_path}
            posterPath={item.image_path}
            active={
              activeVideoId === item.id &&
              isFocused &&
              appIsActive &&
              !reelStart &&
              !zoomImage &&
              !reportModalOpen
            }
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
              })
            }
          />
        ) : null}

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

        <Text
          style={[
            styles.addedBy,
            { fontSize: 13 * textScale },
            darkMode && { color: "#bdbdbd" },
          ]}
        >
          Added by {profileName}
        </Text>

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
      </View>
    );
  };

  return (
    <View
      style={[
        styles.screen,
        darkMode && { backgroundColor: "#101010" },
      ]}
    >
      <Pressable
        style={[
          styles.backButton,
          darkMode && {
            backgroundColor: "#1b1b1b",
            borderColor: "#333",
          },
        ]}
        onPress={() => router.back()}
      >
        <Text
          style={[
            styles.backButtonText,
            darkMode && { color: "#f3f3f3" },
          ]}
        >
          ← Back
        </Text>
      </Pressable>

      <ReportModal />

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

      {loading ? (
        <View style={styles.centerBox}>
          <ActivityIndicator />
          <Text style={styles.smallNote}>Loading profile…</Text>
        </View>
      ) : errorText ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{errorText}</Text>
        </View>
      ) : (
        <>
          <View
            style={[
              styles.headerCard,
              darkMode && {
                backgroundColor: "#1b1b1b",
                borderColor: "#333",
              },
            ]}
          >
            <Text
              style={[
                styles.title,
                darkMode && { color: "#f3f3f3" },
              ]}
            >
              {profileName}
            </Text>
            <Text
              style={[
                styles.subtitle,
                darkMode && { color: "#bdbdbd" },
              ]}
            >
              {jokes.length === 1 ? "1 joke" : `${jokes.length} jokes`}
            </Text>
          </View>

          {jokes.length === 0 ? (
            <View style={styles.centerBox}>
              <Text style={styles.smallNote}>This user has no visible jokes yet.</Text>
            </View>
          ) : (
            <FlatList
              data={finalFeed}
              keyExtractor={(item) => item.id}
              renderItem={renderItem}
              contentContainerStyle={styles.listContent}
              viewabilityConfig={viewabilityConfig}
              onViewableItemsChanged={onViewableItemsChanged}
            />
          )}
        </>
      )}

      <ReelViewer
        startVideo={reelStart}
        language={jokeLanguage}
        onClose={() => setReelStart(null)}
      />

      {toastMessage && (
        <View pointerEvents="none" style={styles.toastContainer}>
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
    paddingTop: 12,
  },

  backButton: {
    alignSelf: "flex-start",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  backButtonText: {
    fontSize: 15,
    color: "#111",
    fontFamily: "OpenSans_600SemiBold",
  },

  headerCard: {
    backgroundColor: "#fff",
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e2e2",
  },

  title: {
    fontSize: 24,
    color: "#111",
    fontFamily: "OpenSans_600SemiBold",
    marginBottom: 4,
  },

  subtitle: {
    fontSize: 14,
    color: "#666",
    fontFamily: "OpenSans_400Regular",
  },

  listContent: {
    paddingHorizontal: 16,
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
    marginBottom: 6,
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

  centerBox: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  smallNote: {
    fontSize: 13,
    color: "#666",
    fontFamily: "OpenSans_400Regular",
    marginTop: 8,
    textAlign: "center",
  },

  errorBox: {
    backgroundColor: "#fff4f4",
    borderWidth: 1,
    borderColor: "#ffd2d2",
    borderRadius: 12,
    padding: 12,
    marginHorizontal: 16,
  },

  errorText: {
    color: "#a40000",
    fontFamily: "OpenSans_400Regular",
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

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.30)",
    justifyContent: "flex-start",
    paddingTop: 60,
    paddingHorizontal: 12,
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

  reportRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  reportDivider: {
    height: 1,
    backgroundColor: "#ddd",
    marginTop: 8,
    marginBottom: 4,
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
});