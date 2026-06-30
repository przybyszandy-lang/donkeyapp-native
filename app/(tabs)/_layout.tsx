import { MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Tabs } from "expo-router";
import React, { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";

const DARK_MODE_KEY = "donkey:darkmode:v1";

export default function TabsLayout() {
  const [darkMode, setDarkMode] = useState(false);

useEffect(() => {
  const loadDarkMode = async () => {
    try {
      const rawDark = await AsyncStorage.getItem(DARK_MODE_KEY);
      setDarkMode(rawDark === "true");
    } catch (e) {
      console.log("Failed to load tab bar dark mode:", e);
      setDarkMode(false);
    }
  };

  loadDarkMode();

  const subscription = DeviceEventEmitter.addListener(
    "darkModeChanged",
    (value) => {
      setDarkMode(value);
    }
  );

  return () => {
    subscription.remove();
  };
}, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: darkMode ? "#101010" : "#ffffff",
          borderTopColor: darkMode ? "#333" : "#ddd",
        },
        tabBarActiveTintColor: "#1877f2",
        tabBarInactiveTintColor: darkMode ? "#bdbdbd" : "#777",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="home-filled" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="favourites"
        options={{
          title: "Favourites",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="favorite" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="add-joke"
        options={{
          title: "Add Joke",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="add-circle" color={color} size={size} />
          ),
        }}
      />

      <Tabs.Screen
        name="my-jokes"
        options={{
          title: "My Jokes",
          tabBarIcon: ({ color, size }) => (
            <MaterialIcons name="person" color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="edit-joke"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="explore"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}