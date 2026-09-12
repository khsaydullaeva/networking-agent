# backend/ — FastAPI + PostgreSQL (Claude Code context for this folder)

You are implementing the API layer between the mobile app and the AI agent.
Read the root `README.md` first for the shared data model — this file does
not repeat it, only extends it with endpoint contracts.

This layer **owns the database** and **owns calling the agent**. It never
talks to Querit or an LLM provider directly — all of that is delegated to
`agent/`, imported as a module or called as a separate local service (your
call; a local Python import is simplest for a hackathon, avoid the
overhead of a second HTTP hop unless the agent team wants process
isolation).

---

## 1. Stack

- FastAPI + `uvicorn`
- `asyncpg` (async Postgres driver) against a hosted Postgres instance —
  Neon, Supabase, Railway, or Vultr Managed Database all have a free/cheap
  tier that works fine for MVP
- `pydantic` v2 models mirroring the shared data model exactly
- Each document (user/connection/quest) is stored as a single JSONB blob
  in an `id, doc` table — this keeps the shared JSON data model in §3 as
  the single source of truth without hand-writing a relational schema for
  a 24h hackathon; Postgres's JSONB containment (`@>`) covers our find-by-field
  queries
- Deploy: a single Vultr instance is enough for MVP; run locally on your
  laptop for most of the hackathon and only deploy near the end if you
  want the sponsor credit story for the pitch

```bash
python -m venv venv && source venv/bin/activate
pip install fastapi uvicorn asyncpg pydantic python-dotenv
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Run with `--host 0.0.0.0` so phones on the same wifi (via Expo Go) can
reach it at `http://<your-laptop-ip>:8000`.

---

## 2. Endpoints

### `POST /users`
```jsonc
// request
{ "name": "string", "goals": ["string"], "links": {"linkedin": "url"} }
// response: 201, full user object with _id
```

### `POST /connections`
Creates a connection, kicks off agent enrichment **asynchronously**
(`BackgroundTasks` or a simple asyncio task — do not make the mobile app
wait synchronously for the LLM + search round trip).
```jsonc
// request
{
  "owner_id": "string",
  "person": { "name": "string", "org": "string", "links": {} },
  "met": { "lat": 0.0, "lng": 0.0, "context_type": "conference" },
  "notes": ["string"]
}
// response: 201, connection object with enrichment: null, quests not yet created
```
Internally: write the connection row immediately (status visible to the
user right away), then call `agent.enrich_and_generate_quests(connection)`
in the background, then update the row and insert quest documents when it
returns.

### `GET /connections/:id`
Returns the full connection including `enrichment` (null until the
background job finishes) and its associated quests. Mobile polls this
every ~2s after creating a connection until `enrichment` is non-null —
acceptable for MVP, no need for websockets.

### `GET /connections?owner_id=`
List all connections for the map screen, each including computed
`warmth` (see §4).

### `POST /quests/:id/complete`
```jsonc
// request: {}
// response: { "quest": {...status: "completed"}, "xp_awarded": 10, "new_total_xp": 130 }
```
Also updates `last_touch` on the parent connection so warmth recalculates
fresh.

---

## 3. Calling the agent

```python
from agent import enrich_and_generate_quests  # see agent/README.md for signature

result = await enrich_and_generate_quests(
    person=connection["person"],
    met_context=connection["met"],
    notes=connection["notes"],
    user_goals=user["goals"],
)
# result: { "enrichment": {...}, "quests": [...] }  — validated JSON, see agent/README.md
```

The agent module is provider-agnostic (see `agent/README.md` §LLM
abstraction) — this layer should never import a specific LLM SDK or know
which provider is active. If the agent call fails or times out, fall back
to a single generic quest ("Send a follow-up message") rather than
blocking the connection from appearing at all.

---

## 4. Warmth calculation — deterministic, no LLM

Compute this in `backend/` (or duplicate client-side in `mobile/` if you
want instant UI feedback without a round trip — pick one source of truth
and stick to it, recommend backend-computed, returned on every `GET`).

```python
import math

def compute_warmth(last_touch_days: float, interaction_count: int, context_weight: float) -> float:
    TAU = 14  # days — tune this during testing, don't leave it unexamined
    recency = math.exp(-last_touch_days / TAU)
    frequency = math.log(1 + interaction_count) / math.log(10)  # normalize roughly to 0-1
    return max(0.0, min(1.0, 0.5 * recency + 0.3 * frequency + 0.2 * context_weight))
```

`context_weight` by `context_type`: work/club = 0.9 (ongoing relationship
likely), conference/orientation = 0.5 (one-off, decays faster). Tune these
two numbers once you see it on the actual map — the exact constants matter
less than the decay being visible on stage.

---

## 5. Demo-mode safety net

Add `DEMO_MODE` env var. When true, `/connections` and `/quests` skip the
real agent call and Querit round trip entirely and return pre-written
fixture enrichment/quests instantly. This is your insurance against venue
wifi dying mid-demo — test this path the night before, not five minutes
before you go on stage.

---

## 6. Auth0 — wire in last

Build every endpoint against a hardcoded `owner_id` string first. Add
Auth0 JWT verification as a dependency (`Depends(verify_token)`) only once
the rest of the API is working end-to-end with mobile, roughly hour 18-20.

---

## 7. Acceptance checklist for this layer

- [ ] `POST /connections` returns immediately (< 500ms) while enrichment
      happens in the background
- [ ] Polling `GET /connections/:id` shows enrichment appear within
      ~10-20s of creation
- [ ] Warmth values visibly differ across connections with different
      `last_touch` and `context_type`
- [ ] `DEMO_MODE=true` produces a full working response with zero network
      calls to Querit or the LLM provider
- [ ] Reachable from a physical phone on the same wifi network as your
      laptop (test this explicitly — `localhost` bindings are a common trap)
- [ ] Agent failures degrade to a fallback quest, never a 500 to mobile
