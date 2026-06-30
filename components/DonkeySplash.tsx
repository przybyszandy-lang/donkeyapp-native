import React, { useEffect } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

export default function DonkeySplash({ onFinish }: { onFinish: () => void }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onFinish();
    }, 4500);

    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <View style={styles.container}>
      <Image
        source={require("../assets/icon-512.png")}
        style={styles.logo}
        resizeMode="contain"
      />

      <Text style={styles.loadingText}>Loading jokes...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0b2a5b",
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: 260,
    height: 260,
  },
  loadingText: {
    position: "absolute",
    bottom: 70,
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
  },
});