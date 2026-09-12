import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import QRCode from "react-native-qrcode-svg";
import { SafeAreaView } from "react-native-safe-area-context";

import { decodeConnectPayload, encodeConnectPayload, generateFallbackCode } from "@/lib/connectCode";
import { useStore } from "@/lib/store";

export default function Connect() {
  const router = useRouter();
  const { user, setPendingConnect } = useStore();
  const [scanning, setScanning] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [permission, requestPermission] = useCameraPermissions();

  const [fallbackCode] = useState(generateFallbackCode());
  const qrValue = encodeConnectPayload({ user_id: user.id, name: user.name, links: user.links });

  const proceedWith = (name: string, org: string) => {
    setPendingConnect({ person: { name, org, links: {} } });
    router.push("/capture");
  };

  const handleScan = async ({ data }: { data: string }) => {
    setScanning(false);
    const payload = decodeConnectPayload(data);
    if (payload) {
      proceedWith(payload.name, payload.org ?? "");
    }
  };

  const handleManualSubmit = () => {
    if (!manualName.trim() || manualCode.length !== 6) return;
    proceedWith(manualName.trim(), "");
  };

  if (scanning) {
    if (!permission?.granted) {
      return (
        <SafeAreaView className="flex-1 bg-black items-center justify-center px-6">
          <Text className="text-white text-center mb-4">Camera access is needed to scan a QR code.</Text>
          <Pressable className="bg-orange-500 px-6 py-3 rounded-xl" onPress={requestPermission}>
            <Text className="text-white font-semibold">Grant camera access</Text>
          </Pressable>
          <Pressable className="mt-4" onPress={() => setScanning(false)}>
            <Text className="text-gray-300">Cancel</Text>
          </Pressable>
        </SafeAreaView>
      );
    }
    return (
      <View className="flex-1 bg-black">
        <CameraView
          style={{ flex: 1 }}
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={handleScan}
        />
        <Pressable className="absolute bottom-12 self-center bg-white/90 px-6 py-3 rounded-xl" onPress={() => setScanning(false)}>
          <Text className="font-semibold">Cancel</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white px-6 pt-8">
      <Text className="text-2xl font-bold text-gray-900 mb-1">Connect</Text>
      <Text className="text-base text-gray-500 mb-6">Show your QR or scan theirs.</Text>

      <View className="items-center bg-gray-50 rounded-2xl py-8 mb-6">
        <QRCode value={qrValue} size={200} />
        <Text className="text-xs text-gray-400 mt-4">Fallback code</Text>
        <Text className="text-3xl font-mono font-bold tracking-widest text-gray-800">{fallbackCode}</Text>
      </View>

      <Pressable className="bg-orange-500 rounded-xl py-4 items-center mb-6" onPress={() => setScanning(true)}>
        <Text className="text-white font-semibold text-base">Scan their QR</Text>
      </Pressable>

      <Text className="text-sm font-semibold text-gray-700 mb-2">
        Or type their fallback code and name
      </Text>
      <TextInput
        value={manualCode}
        onChangeText={setManualCode}
        placeholder="6-digit code"
        keyboardType="number-pad"
        maxLength={6}
        className="border border-gray-300 rounded-xl px-4 py-3 mb-3 text-base"
      />
      <TextInput
        value={manualName}
        onChangeText={setManualName}
        placeholder="Their name"
        className="border border-gray-300 rounded-xl px-4 py-3 mb-4 text-base"
      />
      <Pressable
        disabled={!manualName.trim() || manualCode.length !== 6}
        onPress={handleManualSubmit}
        className={`rounded-xl py-4 items-center ${manualName.trim() && manualCode.length === 6 ? "bg-gray-800" : "bg-gray-300"}`}
      >
        <Text className="text-white font-semibold text-base">Connect manually</Text>
      </Pressable>
    </SafeAreaView>
  );
}
