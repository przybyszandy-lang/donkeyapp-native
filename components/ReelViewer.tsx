// Full-screen, videos-only Reel mode.
//
// SOUND RULES (deliberately separate from the Settings "Video sound" switch):
// - Every Reel video starts WITH sound.
// - The Reel sound button only affects the video on screen. Swiping to the
//   next video turns sound back on.
// - Nothing here reads or writes the phone's Video sound setting.
//
// OVERLAY: close and sound buttons (top), a play/pause button (centre), and
// the description, "Added by" and see-through buttons (favourite, vote,
// report, share) at the bottom. All of them hide when the video is tapped or
// after 7 seconds without any touch; a tap brings them back.
// The centre button pauses until pressed again (overlay stays up while
// paused). Press and hold the video pauses only while held.
//
// The list starts with the tapped video, then loads more videos page by page
// from the database function get_reel_videos (independent of the Home feed).
// Only the video on screen holds a player. Closing Reel removes every player,
// so no sound can keep playing.

import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  DeviceEventEmitter,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  castVote,
  FAVOURITES_CHANGED_EVENT,
  loadFavouriteIds,
  loadVotes,
  reportJoke,
  shareVideo,
  toggleFavourite,
  Vote,
  voteEmoji,
  VOTES_CHANGED_EVENT,
} from "../lib/jokeActions";
import { supabase } from "../lib/supabase";
import { ReelVideo, videoFileUrl } from "../lib/video";
import ReelAdSlot from "./ReelAdSlot";
import { useRetryingPlayer } from "./useRetryingPlayer";

const PAGE_SIZE = 10;
const OVERLAY_HIDE_MS = 7000;

// Full-screen ad page after every AD_EVERY videos.
const ADS_ENABLED = true;
const AD_EVERY = 5;

type ReelAdItem = { id: string; isAd: true };
type ReelItem = ReelVideo | ReelAdItem;

const isAdItem = (item: ReelItem | undefined): item is ReelAdItem =>
  !!item && (item as ReelAdItem).isAd === true;

type Props = {
  startVideo: ReelVideo | null;
  language: string;
  onClose: () => void;
};

function ReelPlayer({
  uri,
  soundOn,
  paused,
}: {
  uri: string;
  soundOn: boolean;
  paused: boolean;
}) {
  const { player, status, errorMessage } = useRetryingPlayer(uri, (p) => {
    p.loop = true;
    p.muted = !soundOn;
    p.audioMixingMode = "auto";
    p.play();
  });

  useEffect(() => {
    player.muted = !soundOn;
  }, [player, soundOn]);

  useEffect(() => {
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [player, paused]);

  return (
    <>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={false}
        surfaceType={Platform.OS === "android" ? "textureView" : undefined}
      />
      {status === "loading" ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator color="#fff" size="large" />
        </View>
      ) : null}
      {status === "error" ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={styles.whiteText}>Video unavailable</Text>
          {errorMessage ? <Text style={styles.errorDetail}>{errorMessage}</Text> : null}
        </View>
      ) : null}
    </>
  );
}

export default function ReelViewer({ startVideo, language, onClose }: Props) {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  const [videos, setVideos] = useState<ReelVideo[]>([]);
  const [index, setIndex] = useState(0);
  const [reelSoundOn, setReelSoundOn] = useState(true);
  const [paused, setPaused] = useState(false);
  const [holding, setHolding] = useState(false);
  const pausedRef = useRef(false);
  const [noMore, setNoMore] = useState(false);

  // Overlay (description + buttons)
  const [overlayVisible, setOverlayVisible] = useState(true);
  const [voteOpen, setVoteOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Same favourites / votes as the rest of the app
  const [favouriteIds, setFavouriteIds] = useState<Set<string>>(new Set());
  const [votes, setVotes] = useState<Record<string, Vote>>({});
  const [reportedIds, setReportedIds] = useState<Set<string>>(new Set());

  const loadingRef = useRef(false);
  const cursorRef = useRef<{ created_at: string | null; id: string | null }>({
    created_at: null,
    id: null,
  });

  // Ads that failed to load before the user reached them are dropped.
  const [failedAdIds, setFailedAdIds] = useState<Set<string>>(new Set());

  // Videos with an ad page after every AD_EVERY videos.
  const items = useMemo<ReelItem[]>(() => {
    const list: ReelItem[] = [];
    videos.forEach((v, i) => {
      list.push(v);
      if (ADS_ENABLED && (i + 1) % AD_EVERY === 0) {
        const adId = `ad-${(i + 1) / AD_EVERY}`;
        if (!failedAdIds.has(adId)) list.push({ id: adId, isAd: true });
      }
    });
    return list;
  }, [videos, failedAdIds]);

  const itemsRef = useRef<ReelItem[]>([]);
  const indexRef = useRef(0);
  useEffect(() => {
    itemsRef.current = items;
    indexRef.current = index;
  }, [items, index]);

  // Only drop an ad page that is still ahead of the user, so the page they
  // are on never jumps. If they are already on it, it shows "swipe for more".
  const onAdFailed = useCallback((adId: string) => {
    const pos = itemsRef.current.findIndex((it) => it.id === adId);
    if (pos > indexRef.current) {
      setFailedAdIds((prev) => new Set(prev).add(adId));
    }
  }, []);

  const visible = !!startVideo;
  const currentItem = items[index];
  const isAdPage = isAdItem(currentItem);
  const current: ReelVideo | undefined = isAdPage ? undefined : (currentItem as ReelVideo | undefined);

  const clearHideTimer = () => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  };

  // Show the overlay and (re)start the 7-second hide timer.
  // While paused the overlay stays up (no timer).
  const showOverlay = useCallback(() => {
    clearHideTimer();
    setOverlayVisible(true);
    if (pausedRef.current) return;
    hideTimerRef.current = setTimeout(() => {
      setOverlayVisible(false);
      setVoteOpen(false);
    }, OVERLAY_HIDE_MS);
  }, []);

  const hideOverlay = () => {
    clearHideTimer();
    setOverlayVisible(false);
    setVoteOpen(false);
  };

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2200);
  };

  useEffect(() => () => clearHideTimer(), []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const togglePause = () => {
    if (paused) {
      pausedRef.current = false;
      setPaused(false);
      showOverlay();
    } else {
      pausedRef.current = true;
      setPaused(true);
      clearHideTimer();
      setOverlayVisible(true);
    }
  };

  // While the vote bubble or report sheet is open, keep the overlay up.
  useEffect(() => {
    if (voteOpen || reportOpen) clearHideTimer();
  }, [voteOpen, reportOpen]);

  // Keep in sync if favourites / votes change elsewhere.
  useEffect(() => {
    const favSub = DeviceEventEmitter.addListener(FAVOURITES_CHANGED_EVENT, (ids: string[]) =>
      setFavouriteIds(new Set(ids))
    );
    const voteSub = DeviceEventEmitter.addListener(VOTES_CHANGED_EVENT, (next: Record<string, Vote>) =>
      setVotes(next)
    );
    return () => {
      favSub.remove();
      voteSub.remove();
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingRef.current || noMore || !startVideo) return;
    loadingRef.current = true;

    try {
      const { data, error } = await supabase.rpc("get_reel_videos", {
        p_language: language,
        p_limit: PAGE_SIZE,
        p_after_created_at: cursorRef.current.created_at,
        p_after_id: cursorRef.current.id,
      });

      if (error) throw error;

      const rows = (data ?? []) as ReelVideo[];
      const last = rows[rows.length - 1];

      if (last) {
        cursorRef.current = { created_at: last.created_at ?? null, id: last.id };
      }

      if (rows.length < PAGE_SIZE) setNoMore(true);

      setVideos((prev) => {
        const known = new Set(prev.map((v) => v.id));
        const fresh = rows.filter((v) => !known.has(v.id) && v.video_path);
        return [...prev, ...fresh];
      });
    } catch (e) {
      console.log("Failed to load reel videos:", e);
      setNoMore(true);
    } finally {
      loadingRef.current = false;
    }
  }, [language, noMore, startVideo]);

  // Each time Reel opens: start fresh with the tapped video, sound ON.
  useEffect(() => {
    if (!startVideo) {
      clearHideTimer();
      return;
    }

    setVideos([startVideo]);
    setFailedAdIds(new Set());
    setIndex(0);
    setReelSoundOn(true);
    pausedRef.current = false;
    setPaused(false);
    setHolding(false);
    setNoMore(false);
    setVoteOpen(false);
    setReportOpen(false);
    setReportReason(null);
    cursorRef.current = { created_at: null, id: null };
    loadingRef.current = false;
    showOverlay();

    loadFavouriteIds().then((ids) => setFavouriteIds(new Set(ids)));
    loadVotes().then(setVotes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startVideo?.id]);

  // Load the first page after the reset above.
  useEffect(() => {
    if (visible && videos.length === 1 && !noMore) {
      loadMore();
    }
  }, [visible, videos.length, noMore, loadMore]);

  const onMomentumScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const newIndex = Math.round(e.nativeEvent.contentOffset.y / height);
    if (newIndex !== index) {
      setIndex(newIndex);
      // Every new Reel video starts with sound and playing, overlay shown.
      setReelSoundOn(true);
      pausedRef.current = false;
      setPaused(false);
      setHolding(false);
      setReportOpen(false);
      setReportReason(null);
      showOverlay();
    }
    if (newIndex >= items.length - 3) {
      loadMore();
    }
  };

  const onTapVideo = () => {
    if (voteOpen || reportOpen) {
      setVoteOpen(false);
      setReportOpen(false);
      setReportReason(null);
      showOverlay();
      return;
    }
    // While paused, a tap keeps the overlay (and play button) on screen.
    if (overlayVisible && !paused) {
      hideOverlay();
    } else {
      showOverlay();
    }
  };

  const onHoldStart = () => setHolding(true);
  const onHoldEnd = () => setHolding(false);

  const openProfile = (video: ReelVideo) => {
    if (!video.user_id) return;
    onClose();
    router.push({ pathname: "/profile/[userId]", params: { userId: video.user_id } });
  };

  const onPressFavourite = async () => {
    if (!current) return;
    showOverlay();
    const next = await toggleFavourite(current.id);
    setFavouriteIds(new Set(next));
  };

  const onPressVote = async (vote: Vote) => {
    if (!current) return;
    setVoteOpen(false);
    showOverlay();
    const ok = await castVote(current.id, vote);
    if (!ok) showToast("Vote saved locally, but failed to sync.");
  };

  const onSubmitReport = async () => {
    if (!current || !reportReason) return;
    const ok = await reportJoke(current.id, reportReason);
    if (!ok) {
      showToast("Report failed. Please try again.");
      return;
    }
    setReportedIds((prev) => new Set(prev).add(current.id));
    setReportOpen(false);
    setReportReason(null);
    showOverlay();
    showToast("Thank you. Report submitted.");
  };

  const renderItem = ({ item, index: itemIndex }: { item: ReelItem; index: number }) => {
    if (isAdItem(item)) {
      return (
        <ReelAdSlot
          width={width}
          height={height}
          topInset={insets.top}
          bottomInset={insets.bottom}
          onFailed={() => onAdFailed(item.id)}
        />
      );
    }

    const uri = videoFileUrl(item.video_path);
    const posterUri = videoFileUrl(item.image_path);
    const isCurrent = itemIndex === index;

    return (
      <View style={{ width, height, backgroundColor: "#000" }}>
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : null}

        {isCurrent && uri ? <ReelPlayer uri={uri} soundOn={reelSoundOn} paused={paused || holding} /> : null}

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={onTapVideo}
          onLongPress={onHoldStart}
          onPressOut={onHoldEnd}
          delayLongPress={250}
          accessibilityLabel="Tap to show or hide buttons, hold to pause"
        />

        {isCurrent && holding && !paused ? (
          <View style={styles.centerOverlay} pointerEvents="none">
            <View style={styles.playBadge}>
              <MaterialIcons name="pause" size={40} color="#fff" />
            </View>
          </View>
        ) : null}
      </View>
    );
  };

  const isFavourite = current ? favouriteIds.has(current.id) : false;
  const myVote = current ? votes[current.id] : undefined;
  const isReported = current ? reportedIds.has(current.id) : false;
  const description = current?.content?.trim() ?? "";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
      supportedOrientations={["portrait"]}
    >
      <View style={styles.screen}>
        {visible ? (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            pagingEnabled
            showsVerticalScrollIndicator={false}
            onMomentumScrollEnd={onMomentumScrollEnd}
            getItemLayout={(_, i) => ({ length: height, offset: height * i, index: i })}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews
            decelerationRate="fast"
            extraData={{ index, reelSoundOn, paused, holding, items }}
          />
        ) : null}

        {/* Bottom overlay: description, author, see-through buttons */}
        {overlayVisible && current ? (
          <View
            style={[styles.bottomOverlay, { paddingBottom: insets.bottom + 20 }]}
            pointerEvents="box-none"
          >
            {current.display_name ? (
              <Text style={styles.authorText}>
                Added by{" "}
                <Text
                  style={styles.authorName}
                  onPress={
                    current.user_id && current.display_name !== "Anonymous"
                      ? () => openProfile(current)
                      : undefined
                  }
                >
                  {current.display_name}
                </Text>
              </Text>
            ) : null}

            {description !== "" ? (
              <Text style={styles.descriptionText} numberOfLines={3}>
                {description}
              </Text>
            ) : null}

            {voteOpen && !myVote ? (
              <View style={styles.voteBubble}>
                {(["bad", "meh", "good", "great"] as Vote[]).map((v) => (
                  <Pressable key={v} onPress={() => onPressVote(v)} hitSlop={6}>
                    <Text style={styles.voteBubbleEmoji}>{voteEmoji(v)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                style={styles.actionButton}
                onPress={onPressFavourite}
                accessibilityLabel={isFavourite ? "Remove from favourites" : "Add to favourites"}
              >
                <MaterialIcons
                  name={isFavourite ? "favorite" : "favorite-border"}
                  size={24}
                  color={isFavourite ? "#ff5a5a" : "#fff"}
                />
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  if (myVote) return;
                  setVoteOpen((o) => !o);
                }}
                accessibilityLabel="Vote"
              >
                <Text style={styles.voteText}>{myVote ? voteEmoji(myVote) : "😕😂"}</Text>
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  if (isReported) return;
                  setVoteOpen(false);
                  setReportReason(null);
                  setReportOpen(true);
                }}
                accessibilityLabel="Report"
              >
                <MaterialCommunityIcons
                  name={isReported ? "flag" : "flag-outline"}
                  size={24}
                  color={isReported ? "#7db3ff" : "#fff"}
                />
              </Pressable>

              <Pressable
                style={styles.actionButton}
                onPress={() => {
                  showOverlay();
                  shareVideo(current.id);
                }}
                accessibilityLabel="Share"
              >
                <MaterialIcons name="share" size={24} color="#fff" />
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Report sheet (inside Reel, same reasons as the rest of the app) */}
        {reportOpen && current ? (
          <View style={[styles.reportSheet, { paddingBottom: insets.bottom + 16 }]}>
            <Text style={styles.reportTitle}>Report video</Text>
            {[
              { key: "offensive", label: "This video is offensive" },
              { key: "illegal", label: "This video is clearly illegal" },
              { key: "other", label: "Other" },
            ].map((r) => (
              <Pressable key={r.key} style={styles.reportItem} onPress={() => setReportReason(r.key)}>
                <Text style={styles.reportItemText}>{r.label}</Text>
                {reportReason === r.key ? <MaterialIcons name="check" size={20} color="#4caf50" /> : null}
              </Pressable>
            ))}
            <View style={styles.reportButtons}>
              <Pressable
                style={[styles.reportButton, !reportReason && styles.reportButtonDisabled]}
                onPress={onSubmitReport}
              >
                <Text style={styles.reportButtonText}>Report</Text>
              </Pressable>
              <Pressable
                style={styles.reportCancel}
                onPress={() => {
                  setReportOpen(false);
                  setReportReason(null);
                  showOverlay();
                }}
              >
                <Text style={styles.reportButtonText}>Close</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {/* Close, sound and play/pause hide and return with the rest of the overlay */}
        {overlayVisible || isAdPage ? (
          <>
            <Pressable
              style={[styles.topButton, { top: insets.top + 12, left: 16 }]}
              onPress={onClose}
              hitSlop={12}
              accessibilityLabel="Close"
            >
              <MaterialIcons name="close" size={28} color="#fff" />
            </Pressable>

            {!isAdPage ? (
              <Pressable
                style={[styles.topButton, { top: insets.top + 12, right: 16 }]}
                onPress={() => {
                  setReelSoundOn((s) => !s);
                  showOverlay();
                }}
                hitSlop={12}
                accessibilityLabel={reelSoundOn ? "Turn sound off" : "Turn sound on"}
              >
                <MaterialIcons name={reelSoundOn ? "volume-up" : "volume-off"} size={26} color="#fff" />
              </Pressable>
            ) : null}

            {current && !reportOpen ? (
              <View style={styles.centerOverlay} pointerEvents="box-none">
                <Pressable
                  style={styles.playBadge}
                  onPress={togglePause}
                  hitSlop={10}
                  accessibilityLabel={paused ? "Play video" : "Pause video"}
                >
                  <MaterialIcons name={paused ? "play-arrow" : "pause"} size={42} color="#fff" />
                </Pressable>
              </View>
            ) : null}
          </>
        ) : null}

        {toast ? (
          <View style={[styles.toast, { top: insets.top + 70 }]} pointerEvents="none">
            <Text style={styles.toastText}>{toast}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#000",
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  topButton: {
    position: "absolute",
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
  },
  bottomOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 40,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  authorText: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 6,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 4,
  },
  authorName: {
    fontWeight: "700",
  },
  descriptionText: {
    color: "#fff",
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 14,
    textShadowColor: "rgba(0,0,0,0.7)",
    textShadowRadius: 4,
  },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  actionButton: {
    width: 56,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.14)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  voteText: {
    fontSize: 18,
  },
  voteBubble: {
    flexDirection: "row",
    alignSelf: "center",
    gap: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 10,
  },
  voteBubbleEmoji: {
    fontSize: 32,
  },
  reportSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#1b1b1b",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 16,
    zIndex: 20,
  },
  reportTitle: {
    color: "#f3f3f3",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  reportItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#333",
  },
  reportItemText: {
    color: "#f3f3f3",
    fontSize: 15,
  },
  reportButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
  },
  reportButton: {
    flex: 1,
    backgroundColor: "#2f71d3",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  reportButtonDisabled: {
    backgroundColor: "#555",
  },
  reportCancel: {
    flex: 1,
    backgroundColor: "#2a2a2a",
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: "center",
  },
  reportButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  whiteText: {
    color: "#fff",
    fontSize: 15,
  },
  errorDetail: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 24,
    textAlign: "center",
  },
  toast: {
    position: "absolute",
    alignSelf: "center",
    backgroundColor: "rgba(0,0,0,0.85)",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    zIndex: 30,
  },
  toastText: {
    color: "#fff",
    fontSize: 14,
  },
});
