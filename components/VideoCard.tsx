// Video area shown inside a normal joke card (Home, Favourites, Profile).
//
// - Only the card marked `active` creates a player. Every other video shows
//   its still preview picture and holds no player, so memory stays low.
// - Sound follows the phone-only "Video sound" setting (soundOn). The speaker
//   icon changes that same setting through onToggleSound.
// - Tapping the video opens Reel mode through onOpen.

import { MaterialIcons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { VideoView } from "expo-video";
import React, { memo, useEffect } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { videoFileUrl } from "../lib/video";
import { useRetryingPlayer } from "./useRetryingPlayer";

type Props = {
  videoPath: string;
  posterPath?: string | null;
  active: boolean;
  soundOn: boolean;
  onToggleSound: () => void;
  onOpen: () => void;
};

function ActivePlayer({ uri, soundOn }: { uri: string; soundOn: boolean }) {
  const { player, status, errorMessage } = useRetryingPlayer(uri, (p) => {
    p.loop = true;
    p.muted = !soundOn;
    // Muted feed videos must never stop the user's own music.
    p.audioMixingMode = soundOn ? "auto" : "mixWithOthers";
    p.play();
  });

  useEffect(() => {
    player.muted = !soundOn;
    player.audioMixingMode = soundOn ? "auto" : "mixWithOthers";
  }, [player, soundOn]);


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
          <ActivityIndicator color="#fff" />
        </View>
      ) : null}
      {status === "error" ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <Text style={styles.errorText}>Video unavailable</Text>
          {errorMessage ? <Text style={styles.errorDetail}>{errorMessage}</Text> : null}
        </View>
      ) : null}
    </>
  );
}

function VideoCardInner({ videoPath, posterPath, active, soundOn, onToggleSound, onOpen }: Props) {
  const uri = videoFileUrl(videoPath);
  const posterUri = videoFileUrl(posterPath);

  if (!uri) return null;

  return (
    <View style={styles.box}>
      {posterUri ? (
        <Image source={{ uri: posterUri }} style={StyleSheet.absoluteFill} contentFit="contain" />
      ) : null}

      {active ? <ActivePlayer uri={uri} soundOn={soundOn} /> : null}

      <Pressable style={StyleSheet.absoluteFill} onPress={onOpen} accessibilityLabel="Open video full screen" />

      {!active ? (
        <View style={styles.centerOverlay} pointerEvents="none">
          <View style={styles.playBadge}>
            <MaterialIcons name="play-arrow" size={34} color="#fff" />
          </View>
        </View>
      ) : null}

      <Pressable
        style={styles.soundButton}
        onPress={onToggleSound}
        hitSlop={10}
        accessibilityLabel={soundOn ? "Turn video sound off" : "Turn video sound on"}
      >
        <MaterialIcons name={soundOn ? "volume-up" : "volume-off"} size={20} color="#fff" />
      </Pressable>
    </View>
  );
}

const VideoCard = memo(VideoCardInner);
export default VideoCard;

const styles = StyleSheet.create({
  box: {
    width: "100%",
    aspectRatio: 4 / 5,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#000",
    marginBottom: 10,
  },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  playBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  soundButton: {
    position: "absolute",
    right: 10,
    bottom: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
  },
  errorDetail: {
    color: "#ccc",
    fontSize: 11,
    marginTop: 4,
    paddingHorizontal: 16,
    textAlign: "center",
  },
});
