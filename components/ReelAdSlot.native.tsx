// Full-screen native ad shown as its own page inside Reel mode
// (one after every 5 videos). Uses the same AdMob native ad units as the
// feed ads, but asks for portrait (tall) creatives so it fills the screen.
//
// The ad is loaded when the page is created (FlatList creates the page just
// before it comes on screen). If no ad can be loaded, onFailed is called so
// Reel can drop this page; if the user is already on it, a "swipe for more"
// message is shown instead of an empty screen.

import { useEffect, useState } from "react";
import { Image, Platform, StyleSheet, Text, View } from "react-native";
import {
  NativeAd,
  NativeAdChoicesPlacement,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaAspectRatio,
  NativeMediaView,
} from "react-native-google-mobile-ads";

const AD_UNIT_ID =
  Platform.select({
    ios: "ca-app-pub-3866370568277471/2688419300",
    android: "ca-app-pub-3866370568277471/6271957624",
  }) || "";

type Props = {
  width: number;
  height: number;
  topInset: number;
  bottomInset: number;
  onFailed: () => void;
};

export default function ReelAdSlot({ width, height, topInset, bottomInset, onFailed }: Props) {
  const [nativeAd, setNativeAd] = useState<NativeAd | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let loadedAdRef: NativeAd | null = null;

    const loadAd = async () => {
      try {
        const loadedAd = await NativeAd.createForAdRequest(AD_UNIT_ID, {
          aspectRatio: NativeMediaAspectRatio.PORTRAIT,
          adChoicesPlacement: NativeAdChoicesPlacement.TOP_RIGHT,
          startVideoMuted: true,
        });
        loadedAdRef = loadedAd;
        if (isMounted) {
          setNativeAd(loadedAd);
        } else {
          loadedAd.destroy();
        }
      } catch (e) {
        console.log("Reel ad load failed:", e);
        if (isMounted) {
          setFailed(true);
          onFailed();
        }
      }
    };

    loadAd();

    return () => {
      isMounted = false;
      if (loadedAdRef) loadedAdRef.destroy();
    };
    // Load once per page.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!nativeAd) {
    return (
      <View style={[styles.page, { width, height }]}>
        {failed ? <Text style={styles.waitText}>Swipe up for more videos</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.page, { width, height, paddingTop: topInset + 64, paddingBottom: bottomInset + 20 }]}>
     <NativeAdView nativeAd={nativeAd} style={styles.adView}>
      <View style={styles.inner}>
        <View style={styles.mediaWrap}>
          <NativeMediaView style={styles.media} resizeMode="contain" />
          <View style={styles.badge} pointerEvents="none">
            <Text style={styles.badgeText}>Sponsored</Text>
          </View>
        </View>

        <View style={styles.infoRow}>
          {nativeAd.icon?.url ? (
            <NativeAsset assetType={NativeAssetType.ICON}>
              <Image source={{ uri: nativeAd.icon.url }} style={styles.icon} />
            </NativeAsset>
          ) : null}
          <View style={styles.infoText}>
            <NativeAsset assetType={NativeAssetType.HEADLINE}>
              <Text style={styles.headline} numberOfLines={2}>
                {nativeAd.headline}
              </Text>
            </NativeAsset>
            {nativeAd.advertiser ? (
              <NativeAsset assetType={NativeAssetType.ADVERTISER}>
                <Text style={styles.advertiser} numberOfLines={1}>
                  {nativeAd.advertiser}
                </Text>
              </NativeAsset>
            ) : null}
          </View>
        </View>

        {nativeAd.body ? (
          <NativeAsset assetType={NativeAssetType.BODY}>
            <Text style={styles.body} numberOfLines={2}>
              {nativeAd.body}
            </Text>
          </NativeAsset>
        ) : null}

        {nativeAd.callToAction ? (
          <NativeAsset assetType={NativeAssetType.CALL_TO_ACTION}>
            <Text style={styles.cta}>{nativeAd.callToAction}</Text>
          </NativeAsset>
        ) : null}
      </View>
     </NativeAdView>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
  },
  adView: {
    flex: 1,
    width: "100%",
  },
  inner: {
    flex: 1,
    width: "100%",
    paddingHorizontal: 16,
  },
  mediaWrap: {
    flex: 1,
    width: "100%",
    marginBottom: 14,
  },
  media: {
    width: "100%",
    height: "100%",
  },
  badge: {
    position: "absolute",
    top: 8,
    left: 8,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    color: "#111",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 10,
  },
  infoText: {
    flex: 1,
  },
  headline: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },
  advertiser: {
    color: "#bbb",
    fontSize: 13,
    marginTop: 2,
  },
  body: {
    color: "#ddd",
    fontSize: 14,
    marginBottom: 12,
  },
  cta: {
    backgroundColor: "#1f5fd1",
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
    paddingVertical: 12,
    borderRadius: 10,
    overflow: "hidden",
  },
  waitText: {
    color: "#bbb",
    fontSize: 15,
  },
});
