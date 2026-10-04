// Creates a video player that recovers by itself.
//
// Videos are first played with on-phone caching (saves bandwidth). On iOS a
// fresh player for a video that was just played can fail to read that cache,
// which showed as "Video unavailable" when scrolling back in Reel mode.
// If the player reports an error, this retries ONCE straight from the
// internet without caching. Only if that also fails is the error shown.

import { useEvent } from "expo";
import { useVideoPlayer, VideoPlayer } from "expo-video";
import { useEffect, useRef, useState } from "react";

export function useRetryingPlayer(
  uri: string,
  setup: (player: VideoPlayer) => void
): { player: VideoPlayer; status: string; errorMessage: string | null } {
  const player = useVideoPlayer({ uri, useCaching: true }, setup);
  const { status, error } = useEvent(player, "statusChange", {
    status: player.status,
    error: undefined,
  });

  const retriedRef = useRef(false);
  const [finalError, setFinalError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "error") return;

    if (!retriedRef.current) {
      retriedRef.current = true;
      player
        .replaceAsync({ uri, useCaching: false })
        .then(() => player.play())
        .catch((e: unknown) => {
          setFinalError(e instanceof Error ? e.message : "Playback failed");
        });
      return;
    }

    setFinalError(error?.message ?? "Playback failed");
  }, [status, error, player, uri]);

  const shownStatus = status === "error" && !finalError ? "loading" : status;

  return { player, status: shownStatus, errorMessage: finalError };
}
