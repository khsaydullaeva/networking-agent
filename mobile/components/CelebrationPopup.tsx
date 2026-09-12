import React, { useEffect, useRef } from "react";
import { Animated, Text, View } from "react-native";

interface Props {
  visible: boolean;
  xp: number;
  streak: number;
  label: string;
  onDone: () => void;
}

// Fires on every XP-awarding action (adding a connection, completing a
// quest) — a real pop-in/pop-out celebration, not just a number changing
// in place. See backend/app/gamification.py for the XP + streak rules
// this is reacting to.
export function CelebrationPopup({ visible, xp, streak, label, onDone }: Props) {
  const scale = useRef(new Animated.Value(0.7)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) return;
    scale.setValue(0.7);
    opacity.setValue(0);
    translateY.setValue(0);

    const animation = Animated.sequence([
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, friction: 5, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]),
      Animated.delay(1100),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 250, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -20, duration: 250, useNativeDriver: true }),
      ]),
    ]);
    animation.start(({ finished }) => {
      if (finished) onDone();
    });
    return () => animation.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  if (!visible) return null;

  return (
    <View
      pointerEvents="none"
      style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center", zIndex: 50 }}
    >
      <Animated.View
        style={{
          transform: [{ scale }, { translateY }],
          opacity,
          backgroundColor: "#f97316",
          borderRadius: 24,
          paddingVertical: 24,
          paddingHorizontal: 36,
          alignItems: "center",
          shadowColor: "#000",
          shadowOpacity: 0.3,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 6 },
          elevation: 8,
        }}
      >
        <Text style={{ fontSize: 32 }}>🎉</Text>
        <Text style={{ color: "white", fontWeight: "700", fontSize: 18, marginTop: 4 }}>{label}</Text>
        <Text style={{ color: "white", fontWeight: "800", fontSize: 26, marginTop: 8 }}>+{xp} XP</Text>
        <Text style={{ color: "white", fontSize: 14, marginTop: 4 }}>🔥 {streak} day streak</Text>
      </Animated.View>
    </View>
  );
}
