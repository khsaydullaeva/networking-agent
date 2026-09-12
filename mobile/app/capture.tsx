import * as Location from "expo-location";
import { Redirect, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";

import { CelebrationPopup } from "@/components/CelebrationPopup";
import { createConnection } from "@/lib/api";
import { useStore } from "@/lib/store";
import type { ContextType, MetContext } from "@/lib/types";

const CONTEXT_TYPES: ContextType[] = ["conference", "club", "orientation", "campus", "work", "other"];

export default function CaptureContext() {
  const router = useRouter();
  const { user, setUser, pendingConnect, setPendingConnect } = useStore();
  const [placeLabel, setPlaceLabel] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [contextType, setContextType] = useState<ContextType>("conference");
  const [note, setNote] = useState("");
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [voiceNoteUri, setVoiceNoteUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [celebration, setCelebration] = useState<{ xp: number; streak: number; connectionId: string } | null>(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const loc = await Location.getCurrentPositionAsync({});
      setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      const [place] = await Location.reverseGeocodeAsync(loc.coords).catch(() => [null]);
      if (place) {
        setPlaceLabel([place.name, place.city].filter(Boolean).join(", "));
      }
    })();
  }, []);

  const startRecording = async () => {
    const { granted } = await requestRecordingPermissionsAsync();
    if (!granted) return;
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  };

  const stopRecording = async () => {
    if (!recorderState.isRecording) return;
    await recorder.stop();
    setVoiceNoteUri(recorder.uri);
  };

  const handleSubmit = async () => {
    if (!pendingConnect || !user) return;
    setSubmitting(true);
    try {
      const met: MetContext = {
        lat: coords?.lat,
        lng: coords?.lng,
        place_label: placeLabel || undefined,
        ts: new Date().toISOString(),
        context_type: contextType,
      };
      const notes = [note, voiceNoteUri ? `[voice note: ${voiceNoteUri}]` : null].filter(Boolean) as string[];

      const connection = await createConnection({
        owner_id: user.id,
        person: pendingConnect.person,
        met,
        notes,
      });
      setUser({ ...user, xp: connection.new_total_xp, streak: connection.streak });
      setCelebration({ xp: connection.xp_awarded, streak: connection.streak, connectionId: connection.id });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCelebrationDone = () => {
    if (!celebration) return;
    setPendingConnect(null);
    router.replace(`/connection/${celebration.connectionId}`);
    setCelebration(null);
  };

  if (!user) return <Redirect href="/login" />;

  if (!pendingConnect) {
    return (
      <SafeAreaView className="flex-1 bg-white items-center justify-center px-6">
        <Text className="text-gray-500 mb-4">No pending connection. Go scan someone first.</Text>
        <Pressable className="bg-orange-500 px-6 py-3 rounded-xl" onPress={() => router.replace("/connect")}>
          <Text className="text-white font-semibold">Back to Connect</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white">
      <CelebrationPopup
        visible={!!celebration}
        xp={celebration?.xp ?? 0}
        streak={celebration?.streak ?? 0}
        label="New connection!"
        onDone={handleCelebrationDone}
      />
      <ScrollView className="px-6 pt-8" contentContainerStyle={{ paddingBottom: 32 }}>
        <Text className="text-2xl font-bold text-gray-900 mb-1">
          Met {pendingConnect.person.name}
        </Text>
        <Text className="text-base text-gray-500 mb-6">Add a bit of context while it's fresh.</Text>

        <Text className="text-sm font-semibold text-gray-700 mb-2">Where</Text>
        <TextInput
          value={placeLabel}
          onChangeText={setPlaceLabel}
          placeholder={coords ? "Label this place" : "Locating..."}
          className="border border-gray-300 rounded-xl px-4 py-3 mb-6 text-base"
        />

        <Text className="text-sm font-semibold text-gray-700 mb-2">Context</Text>
        <View className="flex-row flex-wrap gap-2 mb-6">
          {CONTEXT_TYPES.map((type) => (
            <Pressable
              key={type}
              onPress={() => setContextType(type)}
              className={`px-4 py-2 rounded-full border ${
                contextType === type ? "bg-orange-500 border-orange-500" : "bg-white border-gray-300"
              }`}
            >
              <Text className={contextType === type ? "text-white font-medium" : "text-gray-700"}>{type}</Text>
            </Pressable>
          ))}
        </View>

        <Text className="text-sm font-semibold text-gray-700 mb-2">Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="e.g. works on inference optimization"
          multiline
          className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base min-h-20"
        />

        <Pressable
          onPressIn={startRecording}
          onPressOut={stopRecording}
          className={`rounded-xl py-4 items-center mb-8 ${recorderState.isRecording ? "bg-red-500" : "bg-gray-800"}`}
        >
          <Text className="text-white font-semibold text-base">
            {recorderState.isRecording
              ? "Recording... release to stop"
              : voiceNoteUri
                ? "Re-record voice note"
                : "Hold to record voice note"}
          </Text>
        </Pressable>

        <Pressable disabled={submitting || !!celebration} className="bg-orange-500 rounded-xl py-4 items-center" onPress={handleSubmit}>
          <Text className="text-white font-semibold text-base">{submitting ? "Saving..." : "Save connection"}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
