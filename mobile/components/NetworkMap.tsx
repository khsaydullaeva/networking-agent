import { useRouter } from "expo-router";
import React from "react";
import { Dimensions, Pressable, Text, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";

import type { Connection } from "@/lib/types";
import { warmthColor, warmthOpacity } from "@/lib/warmth";

const { width } = Dimensions.get("window");
const SIZE = Math.min(width - 32, 380);
const CENTER = SIZE / 2;
const RADIUS = SIZE / 2 - 40;

export function NetworkMap({ connections }: { connections: Connection[] }) {
  const router = useRouter();

  const nodes = connections.map((conn, i) => {
    const angle = (2 * Math.PI * i) / Math.max(connections.length, 1) - Math.PI / 2;
    return {
      conn,
      x: CENTER + RADIUS * Math.cos(angle),
      y: CENTER + RADIUS * Math.sin(angle),
    };
  });

  return (
    <View style={{ width: SIZE, height: SIZE, alignSelf: "center" }}>
      <Svg width={SIZE} height={SIZE}>
        {nodes.map(({ conn, x, y }) => (
          <Line
            key={`line-${conn.id}`}
            x1={CENTER}
            y1={CENTER}
            x2={x}
            y2={y}
            stroke={warmthColor(conn.warmth)}
            strokeOpacity={warmthOpacity(conn.warmth) * 0.6}
            strokeWidth={2}
          />
        ))}
        <Circle cx={CENTER} cy={CENTER} r={20} fill="#f97316" />
        {nodes.map(({ conn, x, y }) => (
          <Circle
            key={`node-${conn.id}`}
            cx={x}
            cy={y}
            r={16}
            fill={warmthColor(conn.warmth)}
            opacity={warmthOpacity(conn.warmth)}
          />
        ))}
      </Svg>
      {/* Tap targets overlaid on top of the SVG nodes, and name labels. */}
      {nodes.map(({ conn, x, y }) => (
        <Pressable
          key={`tap-${conn.id}`}
          onPress={() => router.push(`/connection/${conn.id}`)}
          style={{ position: "absolute", left: x - 24, top: y - 24, width: 48, height: 48, alignItems: "center" }}
        >
          <View style={{ width: 32, height: 32 }} />
          <Text numberOfLines={1} style={{ fontSize: 10, color: "#374151", marginTop: 2, maxWidth: 64 }}>
            {conn.person.name.split(" ")[0]}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
