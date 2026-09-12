import { BACKEND_URL, USE_FIXTURES } from "@/lib/config";
import { seedConnections } from "@/lib/fixtures/seedConnections";
import { seedQuests } from "@/lib/fixtures/seedQuests";
import type { Connection, Links, Plan, Quest, User } from "@/lib/types";

// mobile/ never calls the agent directly — only backend/, over REST.
// USE_FIXTURES lets every screen work before backend/ is reachable, and
// doubles as the wifi-outage demo safety net.

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// The backend runs on an in-memory store until Postgres is wired up
// (root README.md §4 DATABASE_URL), so a backend restart wipes all users —
// a session persisted on the phone can then point at a user_id that no
// longer exists. Callers that mutate "the current user" should catch
// ApiError with status 401/404 and prompt a re-login rather than crash.
export function isStaleSessionError(e: unknown): boolean {
  return e instanceof ApiError && (e.status === 404 || e.status === 401);
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${BACKEND_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!resp.ok) {
    throw new ApiError(resp.status, `${init?.method ?? "GET"} ${path} failed: ${resp.status}`);
  }
  return resp.json();
}

let fixtureUser: User = {
  id: "dev-user-1",
  name: "You",
  plans: [
    { id: "plan-1", title: "ML internship", status: "active" },
    { id: "plan-2", title: "Find a cofounder", status: "active" },
  ],
  links: {},
  xp: 0,
  streak: 0,
};

// mutable in-memory copies so completing a quest / creating a connection
// is visible for the rest of the fixture session
const fixtureConnections: Connection[] = seedConnections.map((c) => ({ ...c }));
const fixtureQuests: Record<string, Quest[]> = JSON.parse(JSON.stringify(seedQuests));

// In USE_FIXTURES mode, login is instant and doesn't need a real Auth0
// token — this is a dev/demo convenience, not a security boundary.
export async function authSession(idToken: string): Promise<User> {
  if (USE_FIXTURES) {
    return fixtureUser;
  }
  return request<User>("/auth/session", {
    method: "POST",
    headers: { Authorization: `Bearer ${idToken}` },
  });
}

export async function getUser(id: string): Promise<User> {
  if (USE_FIXTURES) {
    return fixtureUser;
  }
  return request<User>(`/users/${id}`);
}

export async function addPlan(userId: string, title: string): Promise<Plan> {
  if (USE_FIXTURES) {
    const plan: Plan = { id: `plan-${Date.now()}`, title, status: "active" };
    fixtureUser = { ...fixtureUser, plans: [...fixtureUser.plans, plan] };
    return plan;
  }
  return request<Plan>(`/users/${userId}/plans`, {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function updateLinks(userId: string, links: Links): Promise<User> {
  if (USE_FIXTURES) {
    fixtureUser = { ...fixtureUser, links: { ...fixtureUser.links, ...links } };
    return fixtureUser;
  }
  return request<User>(`/users/${userId}/links`, {
    method: "POST",
    body: JSON.stringify(links),
  });
}

export async function listQuests(ownerId: string): Promise<Quest[]> {
  if (USE_FIXTURES) {
    return Object.values(fixtureQuests)
      .flat()
      .filter((q) => q.owner_id === ownerId);
  }
  return request<Quest[]>(`/quests?owner_id=${encodeURIComponent(ownerId)}`);
}

export async function linkQuestToPlan(questId: string, planId: string | null): Promise<Quest> {
  if (USE_FIXTURES) {
    for (const list of Object.values(fixtureQuests)) {
      const quest = list.find((q) => q.id === questId);
      if (quest) {
        quest.plan_id = planId;
        return quest;
      }
    }
    throw new Error("quest not found");
  }
  return request<Quest>(`/quests/${questId}/link-plan`, {
    method: "POST",
    body: JSON.stringify({ plan_id: planId }),
  });
}

export async function createConnection(input: {
  owner_id: string;
  person: Connection["person"];
  met: Connection["met"];
  notes: string[];
}): Promise<Connection> {
  if (USE_FIXTURES) {
    const conn: Connection = {
      id: `local-${Date.now()}`,
      owner_id: input.owner_id,
      person: input.person,
      met: input.met,
      notes: input.notes,
      enrichment: null,
      warmth: 0.2,
      last_touch: new Date().toISOString(),
    };
    fixtureConnections.unshift(conn);
    // simulate the async enrichment backend/ would run in the background
    setTimeout(() => {
      conn.enrichment = {
        role: "New contact",
        interests: [],
        recent_activity: [],
        links: {},
      };
      fixtureQuests[conn.id] = [
        {
          id: `${conn.id}-q1`,
          owner_id: input.owner_id,
          connection_id: conn.id,
          type: "message",
          title: "Send a follow-up message",
          why_now: "You just connected — a quick note while it's fresh keeps the door open.",
          draft_message: "Great meeting you! Would love to stay in touch.",
          status: "pending",
          plan_id: null,
          xp: 10,
          due_at: null,
        },
      ];
    }, 2000);
    return conn;
  }
  return request<Connection>("/connections", { method: "POST", body: JSON.stringify(input) });
}

export async function getConnection(id: string): Promise<Connection> {
  if (USE_FIXTURES) {
    const conn = fixtureConnections.find((c) => c.id === id);
    if (!conn) throw new Error("not found");
    return { ...conn, quests: fixtureQuests[id] ?? [] };
  }
  return request<Connection>(`/connections/${id}`);
}

export async function listConnections(ownerId: string): Promise<Connection[]> {
  if (USE_FIXTURES) {
    return fixtureConnections.filter((c) => c.owner_id === ownerId);
  }
  return request<Connection[]>(`/connections?owner_id=${encodeURIComponent(ownerId)}`);
}

export async function completeQuest(
  questId: string
): Promise<{ quest: Quest; xp_awarded: number; new_total_xp: number }> {
  if (USE_FIXTURES) {
    for (const list of Object.values(fixtureQuests)) {
      const quest = list.find((q) => q.id === questId);
      if (quest) {
        quest.status = "completed";
        const conn = fixtureConnections.find((c) => c.id === quest.connection_id);
        if (conn) {
          conn.warmth = Math.min(1, conn.warmth + 0.3);
          conn.last_touch = new Date().toISOString();
        }
        fixtureUser = { ...fixtureUser, xp: fixtureUser.xp + quest.xp };
        return { quest, xp_awarded: quest.xp, new_total_xp: fixtureUser.xp };
      }
    }
    throw new Error("quest not found");
  }
  return request(`/quests/${questId}/complete`, { method: "POST" });
}
