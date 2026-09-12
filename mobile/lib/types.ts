export type ContextType = "conference" | "club" | "orientation" | "campus" | "work" | "other";
export type QuestType = "message" | "read" | "meet" | "share";
export type QuestStatus = "pending" | "completed";

export interface Links {
  linkedin?: string;
  github?: string;
  twitter?: string;
  [key: string]: string | undefined;
}

export interface User {
  id: string;
  name: string;
  goals: string[];
  links: Links;
  xp: number;
  streak: number;
}

export interface Person {
  name: string;
  org: string;
  links: Links;
}

export interface MetContext {
  lat?: number;
  lng?: number;
  place_label?: string;
  ts?: string;
  context_type: ContextType;
}

export interface Fact {
  fact: string;
  source_url: string;
  date: string | null;
}

export interface Enrichment {
  role?: string | null;
  interests: string[];
  recent_activity: Fact[];
  links: Record<string, string>;
}

export interface Quest {
  id: string;
  owner_id: string;
  connection_id: string;
  type: QuestType;
  title: string;
  why_now: string;
  draft_message: string | null;
  status: QuestStatus;
  xp: number;
  due_at: string | null;
}

export interface Connection {
  id: string;
  owner_id: string;
  person: Person;
  met: MetContext;
  notes: string[];
  enrichment: Enrichment | null;
  warmth: number;
  last_touch: string | null;
  quests?: Quest[];
}
