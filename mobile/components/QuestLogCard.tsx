import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Pressable, Text, View } from "react-native";

import type { Plan, Quest, QuestType } from "@/lib/types";

const TYPE_STYLE: Record<QuestType, { icon: keyof typeof Ionicons.glyphMap; color: string; bg: string; label: string }> = {
  message: { icon: "chatbubble-ellipses", color: "#2563eb", bg: "#eff6ff", label: "Message" },
  read: { icon: "book", color: "#7c3aed", bg: "#f5f3ff", label: "Read" },
  meet: { icon: "people", color: "#ea580c", bg: "#fff7ed", label: "Meet" },
  share: { icon: "share-social", color: "#059669", bg: "#ecfdf5", label: "Share" },
};

function dueLabel(dueAt: string | null): { text: string; color: string } | null {
  if (!dueAt) return null;
  const days = Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86400000);
  if (days < 0) return { text: "Overdue", color: "#dc2626" };
  if (days === 0) return { text: "Due today", color: "#dc2626" };
  if (days === 1) return { text: "Due tomorrow", color: "#ea580c" };
  if (days <= 3) return { text: `Due in ${days}d`, color: "#d97706" };
  return { text: `Due in ${days}d`, color: "#6b7280" };
}

interface Props {
  quest: Quest;
  personName: string;
  plans: Plan[];
  isLinking: boolean;
  onPress: () => void;
  onToggleLinking: () => void;
  onLinkPlan: (planId: string | null) => void;
}

export function QuestLogCard({ quest, personName, plans, isLinking, onPress, onToggleLinking, onLinkPlan }: Props) {
  const style = TYPE_STYLE[quest.type];
  const due = dueLabel(quest.due_at);
  const linkedPlan = plans.find((p) => p.id === quest.plan_id);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ transform: [{ scale: pressed ? 0.98 : 1 }] })}
      className="rounded-2xl mb-3 overflow-hidden bg-white"
    >
      <View style={{ borderLeftWidth: 4, borderLeftColor: style.color }} className="border border-gray-200 border-l-0 rounded-2xl">
        <View className="flex-row items-start p-4 pb-3">
          <View
            style={{ backgroundColor: style.bg }}
            className="w-11 h-11 rounded-full items-center justify-center mr-3"
          >
            <Ionicons name={style.icon} size={20} color={style.color} />
          </View>

          <View className="flex-1">
            <View className="flex-row items-center justify-between mb-0.5">
              <Text style={{ color: style.color }} className="text-[11px] font-bold uppercase tracking-wide">
                {style.label} quest
              </Text>
              <View className="flex-row items-center bg-amber-50 rounded-full px-2 py-0.5">
                <Ionicons name="star" size={11} color="#d97706" />
                <Text className="text-amber-700 text-xs font-bold ml-1">+{quest.xp} XP</Text>
              </View>
            </View>
            <Text className="text-base font-bold text-gray-900 mb-1">{quest.title}</Text>
            <Text className="text-xs text-gray-500 mb-2">From meeting {personName}</Text>

            <View className="flex-row items-center flex-wrap gap-2">
              {due && (
                <View className="flex-row items-center">
                  <Ionicons name="time" size={12} color={due.color} />
                  <Text style={{ color: due.color }} className="text-xs font-semibold ml-1">
                    {due.text}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        <Pressable
          onPress={(e) => {
            e.stopPropagation();
            onToggleLinking();
          }}
          className="flex-row items-center px-4 pb-3"
        >
          <Ionicons name="flag" size={12} color={linkedPlan ? "#ea580c" : "#9ca3af"} />
          <Text className={`text-xs ml-1 font-medium ${linkedPlan ? "text-orange-600" : "text-gray-400"}`}>
            {linkedPlan ? `Quest line: ${linkedPlan.title}` : "Attach to a quest line"}
          </Text>
        </Pressable>

        {isLinking && (
          <View className="flex-row flex-wrap gap-2 px-4 pb-4">
            {plans.map((p) => (
              <Pressable
                key={p.id}
                onPress={(e) => {
                  e.stopPropagation();
                  onLinkPlan(p.id);
                }}
                className={`px-3 py-1 rounded-full ${p.id === quest.plan_id ? "bg-orange-500" : "bg-gray-100"}`}
              >
                <Text className={`text-xs ${p.id === quest.plan_id ? "text-white font-medium" : "text-gray-700"}`}>{p.title}</Text>
              </Pressable>
            ))}
            {quest.plan_id && (
              <Pressable
                onPress={(e) => {
                  e.stopPropagation();
                  onLinkPlan(null);
                }}
                className="px-3 py-1 rounded-full bg-gray-100"
              >
                <Text className="text-xs text-gray-700">Unlink</Text>
              </Pressable>
            )}
          </View>
        )}
      </View>
    </Pressable>
  );
}
