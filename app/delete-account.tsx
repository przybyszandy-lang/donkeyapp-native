import AsyncStorage from "@react-native-async-storage/async-storage";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { supabase } from "../lib/supabase";

const DARK_MODE_KEY = "donkey:darkmode:v1";
const TEXT_SIZE_KEY = "donkey:textsize:v1";

export default function DeleteAccountScreen() {
  const [confirmStage, setConfirmStage] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [textSize, setTextSize] = useState<"Small" | "Normal" | "Large">("Normal");

  const textScale =
    textSize === "Small" ? 0.9 :
    textSize === "Large" ? 1.2 :
    1;

  useEffect(() => {
    loadAppearanceSettings();
  }, []);

  const loadAppearanceSettings = async () => {
    try {
      const rawDark = await AsyncStorage.getItem(DARK_MODE_KEY);
      const rawText = await AsyncStorage.getItem(TEXT_SIZE_KEY);

      setDarkMode(rawDark === "true");

      if (rawText === "Small" || rawText === "Normal" || rawText === "Large") {
        setTextSize(rawText);
      } else {
        setTextSize("Normal");
      }
    } catch (e) {
      console.log("Failed to load delete account appearance settings:", e);
      setDarkMode(false);
      setTextSize("Normal");
    }
  };

  const startDeleteFlow = () => {
    if (deleting) return;
    setConfirmStage(1);
  };

  const goToFinalConfirm = () => {
    if (deleting) return;
    setConfirmStage(2);
  };

  const cancelDelete = () => {
    if (deleting) return;
    setConfirmStage(0);
  };

  const deleteAccount = async () => {
    if (deleting) return;

    try {
      setDeleting(true);

      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) {
        Alert.alert("Error", "No user is currently signed in.");
        setDeleting(false);
        return;
      }

      const { error } = await supabase.rpc("soft_delete_my_account");

      if (error) {
        console.log(error);
        Alert.alert("Error", "Account deletion failed.");
        setDeleting(false);
        return;
      }

      await supabase.auth.signOut();
      router.replace("/");
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "Something went wrong.");
      setDeleting(false);
    }
  };

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      <Text
        style={[
          styles.title,
          { fontSize: 22 * textScale },
          darkMode && styles.titleDark,
        ]}
      >
        Delete Account
      </Text>

      <Text
        style={[
          styles.description,
          { fontSize: 15 * textScale, lineHeight: 22 * textScale },
          darkMode && styles.descriptionDark,
        ]}
      >
        Deleting your account will permanently remove your profile and login access.
        Jokes submitted to the platform may remain visible for moderation and
        community integrity purposes.
      </Text>

      {confirmStage === 0 && (
        <>
          <Pressable
            style={styles.deleteButton}
            onPress={startDeleteFlow}
            disabled={deleting}
          >
            <Text
              style={[
                styles.deleteButtonText,
                { fontSize: 16 * textScale },
              ]}
            >
              Delete My Account
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.cancelButton,
              darkMode && styles.cancelButtonDark,
            ]}
            onPress={() => router.replace("/settings")}
            disabled={deleting}
          >
            <Text
              style={[
                styles.cancelText,
                { fontSize: 15 * textScale },
                darkMode && styles.cancelTextDark,
              ]}
            >
              Cancel
            </Text>
          </Pressable>
        </>
      )}

      {confirmStage === 1 && (
        <>
          <Text
            style={[
              styles.warningText,
              { fontSize: 16 * textScale, lineHeight: 22 * textScale },
              darkMode && styles.warningTextDark,
            ]}
          >
            Are you sure you want to delete your account?
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={styles.yesDeleteButton}
              onPress={goToFinalConfirm}
              disabled={deleting}
            >
              <Text
                style={[
                  styles.yesDeleteText,
                  { fontSize: 16 * textScale },
                ]}
              >
                Yes, Delete
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.keepButton,
                darkMode && styles.keepButtonDark,
              ]}
              onPress={cancelDelete}
              disabled={deleting}
            >
              <Text
                style={[
                  styles.keepButtonText,
                  { fontSize: 15 * textScale },
                  darkMode && styles.keepButtonTextDark,
                ]}
              >
                No, Keep It
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {confirmStage === 2 && (
        <>
          <Text
            style={[
              styles.warningText,
              { fontSize: 16 * textScale, lineHeight: 22 * textScale },
              darkMode && styles.warningTextDark,
            ]}
          >
            Final confirmation. This action cannot be undone.
          </Text>

          <View style={styles.buttonRow}>
            <Pressable
              style={[
                styles.keepButton,
                darkMode && styles.keepButtonDark,
              ]}
              onPress={cancelDelete}
              disabled={deleting}
            >
              <Text
                style={[
                  styles.keepButtonText,
                  { fontSize: 15 * textScale },
                  darkMode && styles.keepButtonTextDark,
                ]}
              >
                No, Keep It
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.yesDeleteButton,
                deleting && styles.deleteButtonDisabled,
              ]}
              onPress={deleteAccount}
              disabled={deleting}
            >
              <Text
                style={[
                  styles.yesDeleteText,
                  { fontSize: 16 * textScale },
                ]}
              >
                {deleting ? "Deleting..." : "Yes, Delete"}
              </Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#efefef",
    padding: 20,
    justifyContent: "center",
  },

  containerDark: {
    backgroundColor: "#101010",
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 16,
    textAlign: "center",
    color: "#111",
  },

  titleDark: {
    color: "#f3f3f3",
  },

  description: {
    fontSize: 15,
    color: "#444",
    textAlign: "center",
    marginBottom: 30,
    lineHeight: 22,
  },

  descriptionDark: {
    color: "#c7c7c7",
  },

  warningText: {
    fontSize: 16,
    color: "#8b0000",
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 18,
    lineHeight: 22,
  },

  warningTextDark: {
    color: "#ff9b9b",
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 12,
  },

  deleteButton: {
    backgroundColor: "#d62828",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },

  deleteButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  yesDeleteButton: {
    flex: 1,
    backgroundColor: "#d62828",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  yesDeleteText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  keepButton: {
    flex: 1,
    backgroundColor: "#ddd",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },

  keepButtonDark: {
    backgroundColor: "#2a2a2a",
  },

  keepButtonText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },

  keepButtonTextDark: {
    color: "#f3f3f3",
  },

  cancelButton: {
    backgroundColor: "#ddd",
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },

  cancelButtonDark: {
    backgroundColor: "#2a2a2a",
  },

  cancelText: {
    fontSize: 15,
    color: "#333",
    fontWeight: "600",
  },

  cancelTextDark: {
    color: "#f3f3f3",
  },

  deleteButtonDisabled: {
    backgroundColor: "#e08b8b",
  },
});