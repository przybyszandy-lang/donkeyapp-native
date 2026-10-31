import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import { AppState, Platform, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DonkeySplash from "../components/DonkeySplash";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    if (Platform.OS === "web") return;

    const initConsent = async () => {
      try {
        const { AdsConsent } = await import("react-native-google-mobile-ads");
        await AdsConsent.requestInfoUpdate();
        await AdsConsent.loadAndShowConsentFormIfRequired();
      } catch (e) {
        console.log("Consent init failed:", e);
      }

      // Apple App Tracking Transparency: ask before ads can use the
      // advertising ID. Shown once; iOS remembers the answer.
      if (Platform.OS === "ios") {
        try {
          const { getTrackingPermissionsAsync, requestTrackingPermissionsAsync } =
            await import("expo-tracking-transparency");
          // iOS silently ignores the request if the app is not fully on
          // screen yet (e.g. no ad consent form shown, as in the US), so
          // wait until the app is active, then a short pause.
          if (AppState.currentState !== "active") {
            await new Promise<void>((resolve) => {
              const sub = AppState.addEventListener("change", (st) => {
                if (st === "active") {
                  sub.remove();
                  resolve();
                }
              });
            });
          }
          await new Promise((r) => setTimeout(r, 1000));
          const current = await getTrackingPermissionsAsync();
          if (current.status === "undetermined") {
            await requestTrackingPermissionsAsync();
          }
        } catch (e) {
          console.log("Tracking permission request failed:", e);
        }
      }
    };

    initConsent();
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: {},
        }}
      />

      {showSplash && (
        <View style={styles.splashOverlay}>
          <DonkeySplash onFinish={() => setShowSplash(false)} />
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  splashOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
  },
});