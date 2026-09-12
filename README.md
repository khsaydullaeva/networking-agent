# [App Name TBD] — AI-Powered Networking Agent

> Meet someone → the app captures context → an agent enriches who they are with
> sourced facts → generates concrete follow-up quests → you complete the quest
> **in real life** → your network map updates.
>
> The score goes up when you leave the app.

Hackathon: HackCMU (MLH). Track: **Multiplayer / Touch the Grass** (optionally
combined with **Institute of Foundation Models (IFM)**). Sponsors targeted:
**IFM**, ElevenLabs, Auth0, Vultr.

This is the root README. Each implementation layer has its own README meant
to be dropped into Claude Code as the working context for that folder. Work
on `mobile/`, `backend/`, and `agent/` can happen in parallel — the only
shared contract between them is the API spec and data model below.

---

## 1. Product scope (MVP)

**In scope — the one loop that must work end-to-end:**

1. Two phones scan a QR code (or 6-digit fallback code) to connect.
2. Context is auto-captured: GPS → place label, timestamp, plus a typed or
   voice note ("met at career fair, works on inference optimization").
3. Backend triggers the agent, which:
   - fetches the profile links shared for the new contact (LinkedIn,
     Instagram, Facebook, ... — no general web search by name),
   - extracts facts with a source URL attached to each one,
   - generates 2–3 concrete, dated follow-up quests, grounded in those
     facts **or** in a specific detail from the connection's notes (a
     meeting time, a plan) when there are no facts to work with.
4. Quests render as cards (`message` / `read` / `meet` / `share`) on the
   phone. Completing one — and adding a connection in the first place —
   awards XP and increments a daily streak, with a celebration animation
   on both, not just a number changing in place. Completing a quest also
   brightens that contact's node on a network map; uncompleted contacts
   visually dim over time ("warmth decay").

**Explicitly out of scope for MVP** (say "post-MVP" if asked, don't build):
calendar OAuth integration, the app sending messages on the user's behalf,
scheduled push notifications, friend recommendations / graph traversal,
teams or leaderboards, a web dashboard, offline sync.

**Non-negotiable "this is not a wrapper" signals** — cut other features
before cutting these:

- Live two-phone exchange (not a single-player form).
- Every enrichment fact is traceable to a `source_url`; unsourced facts are
  dropped, not shown.
- Warmth decay and XP/streaks are deterministic formulas, not an LLM call.

---

## 2. Architecture

```
┌─────────────┐      REST/JSON       ┌─────────────┐      REST/JSON      ┌─────────────┐
│   mobile/   │ ───────────────────► │  backend/   │ ──────────────────► │   agent/    │
│ Expo (RN)   │ ◄─────────────────── │  FastAPI    │ ◄────────────────── │  Python     │
└─────────────┘                      └──────┬──────┘                    └──────┬──────┘
                                             │                                  │
                                             ▼                                  ▼
                                      ┌─────────────┐                   ┌───────────────┐
                                      │ PostgreSQL  │                   │ Shared profile │
                                      │ (JSONB)     │                   │ links (fetch)  │
                                      └─────────────┘                   │ LLM provider   │
                                                                         │ (K2/Gemini/    │
                                                                         │  Grok — see    │
                                                                         │  agent/README) │
                                                                         └───────────────┘
```

- `mobile/` never calls the agent directly — only `backend/`.
- `backend/` never calls the LLM directly — only `agent/` does, through the
  provider abstraction, so the model can change without touching backend
  or mobile code at all.
- `agent/` is stateless — it takes a connection's data in, returns
  enrichment + quests out, and writes nothing to the DB itself.

---

## 3. Shared data model (source of truth — do not diverge per layer)

```jsonc
// users
{
  "_id": "ObjectId",
  "auth0_id": "string | null",   // set once the user signs up / logs in via Auth0
  "name": "string",
  "plans": [                     // "improvement plans" — was a plain string[] of goals;
    {                            // now a real entity so quests can link to one
      "id": "string",
      "title": "string",        // e.g. "ML internship", "cofounder", "friendship"
      "status": "active | done"
    }
  ],
  "links": { "linkedin": "url", "github": "url", "twitter": "url" },
  "xp": 0,
  "streak": 0,               // consecutive UTC days with 1+ XP-awarding action
  "last_activity_date": "YYYY-MM-DD | null"   // drives streak, see backend/README §5
}

// connections
{
  "_id": "ObjectId",
  "owner_id": "ObjectId",         // the user who made this connection
  "person": {
    "name": "string",
    "org": "string",
    "links": { "linkedin": "url", "twitter": "url", "..." : "url" }
  },
  "met": {
    "lat": 0.0, "lng": 0.0,
    "place_label": "string",      // reverse-geocoded or user-entered
    "ts": "ISO8601",
    "context_type": "conference | club | orientation | campus | work | other"
  },
  "notes": ["string"],            // typed or transcribed voice notes
  "enrichment": {
    "role": "string",
    "interests": ["string"],
    "recent_activity": [
      { "fact": "string", "source_url": "string", "date": "string" }
    ],
    "links": { "...": "url" }
  },
  "warmth": 0.0,                  // 0-1, computed client- or server-side, no LLM
  "last_touch": "ISO8601"
}

// quests
{
  "_id": "ObjectId",
  "owner_id": "ObjectId",
  "connection_id": "ObjectId",
  "type": "message | read | meet | share",
  "title": "string",
  "why_now": "string",            // must reference a specific enrichment fact
  "draft_message": "string | null",
  "status": "pending | completed",
  "plan_id": "string | null",     // links this follow-up task to one of the user's plans
  "xp": 0,
  "due_at": "ISO8601"
}
```

Full JSON Schemas for API request/response bodies live in `backend/README.md`.
Full JSON Schemas for what the agent must return live in `agent/README.md`.

---

## 4. Env vars (root `.env`, referenced by all layers)

| Var | Used by | Notes |
|---|---|---|
| `DATABASE_URL` | backend | Postgres connection string (Neon/Supabase/Railway/Vultr) |
| `BACKEND_URL` | mobile | e.g. `http://<laptop-ip>:8000` for Expo Go on physical devices |
| `LLM_PROVIDER` | agent | `k2` \| `gemini` \| `grok` — see `agent/README.md` |
| `LLM_API_KEY` | agent | key for whichever provider is active |
| `AUTH0_DOMAIN` / `AUTH0_CLIENT_ID` | mobile, backend | sign up / log in — works out of the box with Auth0's default email/password connection, see backend/README §7 |
| `ELEVENLABS_API_KEY` | backend or agent | optional, daily quest voice briefing |

---

## 5. Team split & build order

| Owner | Folder | Starts | Blocks on |
|---|---|---|---|
| P1 | `mobile/` (shell: QR, connect flow, capture) | Hour 0 | nothing — build against mocked backend responses first |
| P2 | `mobile/` (gamified UI: map, quest cards, XP) | Hour 0 | nothing — build against seed/fixture data first |
| P3 | `backend/` | Hour 0 | nothing — Auth0 goes in last, ~hour 18-20 |
| P4 | `agent/` | Hour 0 | nothing — build against 5 hand-written fake profiles before touching real LLM calls |

**Hour 10 checkpoint:** two phones connecting must produce a real row in
Postgres. If this isn't true, stop everything else and fix only this.

**Hour 20:** feature freeze. Rehearse the demo, record a backup video in
case venue wifi dies.

---

## 6. Demo script (2:45)

1. (0:20) Problem statement — one line.
2. (0:50) Two phones scan, connection appears on both, voice note recorded.
3. (1:40) Agent runs live on screen — sources found, quests appear, each
   citing something specific.
4. (2:20) Cut to a seeded network map — 8 contacts, some dimming. Complete a
   quest, node brightens, XP fires.
5. (2:40) "The score goes up when you leave the app."

Keep a `DEMO_MODE=true` env flag (see `backend/README.md`) that serves
cached/fixture data if wifi fails during judging.
