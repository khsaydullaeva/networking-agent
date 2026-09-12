import type { Quest } from "@/lib/types";

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
      xp: 10,
      due_at: null,
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
      xp: 5,
      due_at: null,
    },
  ],
};
