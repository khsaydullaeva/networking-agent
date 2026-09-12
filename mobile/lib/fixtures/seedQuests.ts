import type { Quest } from "@/lib/types";

const inDays = (n: number) => new Date(Date.now() + n * 86400000).toISOString();

export const seedQuests: Record<string, Quest[]> = {
  "seed-1": [
    {
      id: "seed-1-q1",
      owner_id: "dev-user-1",
      connection_id: "seed-1",
      type: "message",
      title: "Follow up on her sparse routing paper",
      why_now: "Her paper on sparse routing (posted 3 weeks ago) relates directly to the inference problem you discussed — ask how her approach compares.",
      draft_message: "Hey Ava! Loved talking inference optimization at the career fair — read your sparse routing paper, would love to hear more about it.",
      status: "pending",
      plan_id: "plan-1",
      xp: 10,
      due_at: inDays(-1), // overdue, for the urgency state
    },
  ],
  "seed-2": [
    {
      id: "seed-2-q1",
      owner_id: "dev-user-1",
      connection_id: "seed-2",
      type: "read",
      title: "Read his talk on real-time search APIs",
      why_now: "His talk on real-time search APIs for agents is directly relevant to what you're building.",
      draft_message: null,
      status: "pending",
      plan_id: null,
      xp: 5,
      due_at: inDays(1),
    },
  ],
  "seed-3": [
    {
      id: "seed-3-q1",
      owner_id: "dev-user-1",
      connection_id: "seed-3",
      type: "meet",
      title: "Set up a coffee chat about vector search",
      why_now: "She's building vector search indexes at MongoDB — a quick chat could uncover a project collaboration.",
      draft_message: null,
      status: "pending",
      plan_id: null,
      xp: 10,
      due_at: inDays(5),
    },
  ],
  "seed-4": [
    {
      id: "seed-4-q1",
      owner_id: "dev-user-1",
      connection_id: "seed-4",
      type: "share",
      title: "Share your model routing benchmark",
      why_now: "Diego just released a routing benchmark — sharing your own results keeps the conversation going.",
      draft_message: null,
      status: "pending",
      plan_id: "plan-2",
      xp: 10,
      due_at: inDays(3),
    },
  ],
};
