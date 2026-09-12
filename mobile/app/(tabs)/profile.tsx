import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { isStaleSessionError, updateLinks } from "@/lib/api";
import { handleStaleSession } from "@/lib/session";
import { useStore } from "@/lib/store";

export default function Profile() {
  const router = useRouter();
  const { user, setUser, logout } = useStore();
  const [linkedin, setLinkedin] = useState(user?.links.linkedin ?? "");
  const [instagram, setInstagram] = useState(user?.links.instagram ?? "");
  const [facebook, setFacebook] = useState(user?.links.facebook ?? "");
  const [savingLinks, setSavingLinks] = useState(false);

  useEffect(() => {
    setLinkedin(user?.links.linkedin ?? "");
    setInstagram(user?.links.instagram ?? "");
    setFacebook(user?.links.facebook ?? "");
  }, [user?.links.linkedin, user?.links.instagram, user?.links.facebook]);

  if (!user) return null;

  const handleSaveLinks = async () => {
    setSavingLinks(true);
    try {
      const updatedUser = await updateLinks(user.id, {
        linkedin: linkedin.trim() || undefined,
        instagram: instagram.trim() || undefined,
        facebook: facebook.trim() || undefined,
      });
      setUser(updatedUser);
    } catch (e) {
      if (isStaleSessionError(e)) await handleStaleSession(logout);
      else Alert.alert("Couldn't save links", "Please try again.");
    } finally {
      setSavingLinks(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Log out?", undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/login");
        },
      },
    ]);
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <View className="px-6 pt-4">
        <Text className="text-2xl font-bold text-gray-900">Profile</Text>
      </View>

      <ScrollView className="px-6 pt-4" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-xl font-bold text-gray-900 mb-1">{user.name}</Text>
        <Text className="text-orange-600 font-semibold mb-8">{user.xp} XP · 🔥 {user.streak} streak</Text>

        <Text className="text-lg font-bold text-gray-900 mb-3">Your links</Text>
        <Text className="text-xs text-gray-500 mb-2">
          Shown to people you connect with, and shared via your QR code.
        </Text>
        <TextInput
          value={linkedin}
          onChangeText={setLinkedin}
          placeholder="Your LinkedIn URL"
          autoCapitalize="none"
          keyboardType="url"
          className="border border-gray-300 rounded-xl px-4 py-2 mb-2 text-sm"
        />
        <TextInput
          value={instagram}
          onChangeText={setInstagram}
          placeholder="Your Instagram URL"
          autoCapitalize="none"
          keyboardType="url"
          className="border border-gray-300 rounded-xl px-4 py-2 mb-2 text-sm"
        />
        <TextInput
          value={facebook}
          onChangeText={setFacebook}
          placeholder="Your Facebook URL"
          autoCapitalize="none"
          keyboardType="url"
          className="border border-gray-300 rounded-xl px-4 py-2 mb-3 text-sm"
        />
        <Pressable
          disabled={savingLinks}
          onPress={handleSaveLinks}
          className="self-start px-4 py-2 rounded-xl bg-gray-800 mb-10"
        >
          <Text className="text-white text-sm font-medium">{savingLinks ? "Saving..." : "Save links"}</Text>
        </Pressable>

        <Pressable onPress={handleLogout} className="self-start px-4 py-2 rounded-xl border border-red-300">
          <Text className="text-red-600 text-sm font-medium">Log out</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
