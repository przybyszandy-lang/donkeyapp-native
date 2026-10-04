// Full-screen, videos-only Reel mode.
//
// SOUND RULES (deliberately separate from the Settings "Video sound" switch):
// - Every Reel video starts WITH sound.
// - The Reel sound button only affects the video on screen. Swiping to the
//   next video turns sound back on.
// - Nothing here reads or writes the phone's Video sound setting.
//
// The list starts with the tapped video, then loads more videos page by page
// from the database function get_reel_videos (independent of the Home feed).
// Only the video on screen holds a player. Closing Reel removes every player,
// so no sound can keep playing.

import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { router } from "expo-router";
import { VideoView } from "expo-video";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
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

import { supabase } from "../lib/supabase";
import { ReelVideo, videoFileUrl } from "../lib/video";
import { useRetryingPlayer } from "./useRetryingPlayer";

const PAGE_SIZE = 10;

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
  const [noMore, setNoMore] = useState(false);

  const loadingRef = useRef(false);
  const cursorRef = useRef<{ created_at: string | null; id: string | null }>({
    created_at: null,
    id: null,
  });

  const visible = !!startVideo;

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
    if (!startVideo) return;

    setVideos([startVideo]);
    setIndex(0);
    setReelSoundOn(true);
    setPaused(false);
    setNoMore(false);
    cursorRef.current = { created_at: null, id: null };
    loadingRef.current = false;
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
      // Every new Reel video starts with sound and playing.
      setReelSoundOn(true);
      setPaused(false);
    }
    if (newIndex >= videos.length - 3) {
      loadMore();
    }
  };

  const openProfile = (video: ReelVideo) => {
    if (!video.user_id) return;
    onClose();
    router.push({ pathname: "/profile/[userId]", params: { userId: video.user_id } });
  };

  const renderItem = ({ item, index: itemIndex }: { item: ReelVideo; index: number }) => {
    const uri = videoFileUrl(item.video_path);
    const posterUri = videoFileUrl(item.image_path);
    const isCurrent = itemIndex === index;

    return (
      <View style={{ width, height, backgroundColor: "#000" }}>
        {posterUri ? (
          <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        ) : null}

        {isCurrent && uri ? <ReelPlayer uri={uri} soundOn={reelSoundOn} paused={paused} /> : null}

        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setPaused((p) => !p)}
          accessibilityLabel={paused ? "Play video" : "Pause video"}
        />

        {isCurrent && paused ? (
          <View style={styles.centerOverlay} pointerEvents="none">
            <View style={styles.playBadge}>
              <MaterialIcons name="play-arrow" size={44} color="#fff" />
            </View>
          </View>
        ) : null}

        {item.display_name ? (
          <View style={[styles.authorRow, { bottom: insets.bottom + 24 }]} pointerEvents="box-none">
            <Text style={styles.whiteText}>
              Added by{" "}
              <Text
                style={[styles.whiteText, styles.authorName]}
                onPress={item.user_id && item.display_name !== "Anonymous" ? () => openProfile(item) : undefined}
              >
                {item.display_name}
              </Text>
            </Text>
          </View>
        ) : null}
      </View>
    );
  };

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
            data={videos}
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
            extraData={{ index, reelSoundOn, paused }}
          />
        ) : null}

        <Pressable
          style={[styles.topButton, { top: insets.top + 12, left: 16 }]}
          onPress={onClose}
          hitSlop={12}
          accessibilityLabel="Close"
        >
          <MaterialIcons name="close" size={28} color="#fff" />
        </Pressable>

        <Pressable
          style={[styles.topButton, { top: insets.top + 12, right: 16 }]}
          onPress={() => setReelSoundOn((s) => !s)}
          hitSlop={12}
          accessibilityLabel={reelSoundOn ? "Turn sound off" : "Turn sound on"}
        >
          <MaterialIcons name={reelSoundOn ? "volume-up" : "volume-off"} size={26} color="#fff" />
        </Pressable>
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
  authorRow: {
    position: "absolute",
    left: 16,
    right: 80,
  },
  whiteText: {
    color: "#fff",
    fontSize: 15,
    textShadowColor: "rgba(0,0,0,0.6)",
    textShadowRadius: 4,
  },
  authorName: {
    fontWeight: "700",
  },
  errorDetail: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 6,
    paddingHorizontal: 24,
    textAlign: "center",
  },
});
