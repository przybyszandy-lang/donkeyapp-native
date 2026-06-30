import { useEffect, useState } from "react";
import { Dimensions, Platform, Text, View } from "react-native";
import {
  NativeAd,
  NativeAdView,
  NativeAsset,
  NativeAssetType,
  NativeMediaView,
} from "react-native-google-mobile-ads";

const AD_UNIT_ID =
  Platform.select({
    ios: "ca-app-pub-3866370568277471/2688419300",
    android: "ca-app-pub-3866370568277471/6271957624",
  }) || "";

export default function FeedAdSlot({ darkMode }: { darkMode: boolean }) {
  const screenWidth = Dimensions.get("window").width;
  const adCardWidth = screenWidth - 24;

  const [nativeAd, setNativeAd] = useState<any | null>(null);

  useEffect(() => {
    let isMounted = true;
    let loadedAdRef: any | null = null;

    const loadAd = async () => {
      try {
        const loadedAd = await NativeAd.createForAdRequest(AD_UNIT_ID);
        loadedAdRef = loadedAd;

        if (isMounted) {
          setNativeAd(loadedAd);
        } else {
          loadedAd.destroy();
        }
      } catch (e) {
        console.log("Ad load failed:", e);
      }
    };

    loadAd();

    return () => {
      isMounted = false;
      if (loadedAdRef) {
        loadedAdRef.destroy();
      }
    };
  }, []);

  if (!nativeAd) return null;

const aspectRatio =
  nativeAd.mediaContent?.aspectRatio && nativeAd.mediaContent.aspectRatio > 0
    ? nativeAd.mediaContent.aspectRatio
    : 1.78;

const rawMediaHeight = Math.round((adCardWidth - 20) / aspectRatio);

const mediaHeight = Math.max(rawMediaHeight, 160);

  return (
    <NativeAdView
      nativeAd={nativeAd}
      style={{
        width: adCardWidth,
        alignSelf: "center",
        marginBottom: 12,
        backgroundColor: darkMode ? "#1b1b1b" : "#ffffff",
        borderWidth: 1,
        borderColor: darkMode ? "#333" : "#e2e2e2",
        borderRadius: 10,
        overflow: "hidden",
      }}
    >
      <View style={{ padding: 10 }}>

        <Text
          style={{
            fontSize: 11,
            marginBottom: 6,
            color: darkMode ? "#888" : "#999",
            textTransform: "uppercase",
            letterSpacing: 0.5,
          }}
        >
          Sponsored
        </Text>

        <NativeMediaView
          style={{
            width: adCardWidth - 20,
            height: mediaHeight,
            marginBottom: 8,
          }}
          resizeMode="cover"
        />

        <NativeAsset assetType={NativeAssetType.HEADLINE}>
          <Text
            style={{
              fontSize: 15,
              fontWeight: "600",
              marginBottom: 4,
              color: darkMode ? "#f3f3f3" : "#111",
            }}
          >
            {nativeAd.headline}
          </Text>
        </NativeAsset>

        <NativeAsset assetType={NativeAssetType.BODY}>
          <Text
            style={{
              fontSize: 13,
              marginBottom: 6,
              color: darkMode ? "#bdbdbd" : "#555",
            }}
          >
            {nativeAd.body}
          </Text>
        </NativeAsset>

      </View>
    </NativeAdView>
  );
}