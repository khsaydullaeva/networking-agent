import os
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException

from .agent_client import enrich_and_generate_quests
from .auth import verify_token
from .db import get_db, serialize
from .dedupe import find_existing_connection
from .demo_fixtures import DEMO_ENRICHMENT, DEMO_QUESTS
from .gamification import CONNECTION_XP, award_xp
from .models import ConnectionCreate, LinkQuestToPlan, Links, PlanCreate, UserCreate
from .warmth import warmth_for_connection

app = FastAPI(title="Networking Agent Backend")


def demo_mode() -> bool:
    return os.environ.get("DEMO_MODE", "").lower() in ("1", "true", "yes")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def due_at_from_days(due_days: int | None) -> str | None:
    if due_days is None:
        return None
    return (datetime.now(timezone.utc) + timedelta(days=due_days)).isoformat()


def goals_to_plans(goals: list[str]) -> list[dict]:
    return [{"id": str(uuid.uuid4()), "title": title, "status": "active"} for title in goals]


@app.post("/users", status_code=201)
async def create_user(body: UserCreate):
    """Manual/dev user creation — no login required. Prefer POST /auth/session
    once Auth0/LinkedIn login is wired in on the client (see §6/§7 below)."""
    db = get_db()
    doc = await db.users.insert_one(
        {
            "name": body.name,
            "plans": goals_to_plans(body.goals),
            "links": body.links.model_dump(exclude_none=True),
            "auth0_id": None,
            "xp": 0,
            "streak": 0,
        }
    )
    return serialize(doc)


@app.post("/auth/session")
async def auth_session(claims: dict = Depends(verify_token)):
    """Called right after a successful Auth0/LinkedIn login on the client,
    with the Auth0 ID token as the bearer token. Gets-or-creates the local
    user row keyed by the token's `sub` (Auth0's stable user id)."""
    db = get_db()
    auth0_id = claims["sub"]
    existing = await db.users.find_one({"auth0_id": auth0_id})
    if existing:
        return serialize(existing)

    doc = await db.users.insert_one(
        {
            "name": claims.get("name") or claims.get("nickname") or "New user",
            "plans": [],
            "links": {},
            "auth0_id": auth0_id,
            "xp": 0,
            "streak": 0,
        }
    )
    return serialize(doc)


@app.get("/users/{user_id}")
async def get_user(user_id: str):
    db = get_db()
    doc = await db.users.find_one({"_id": user_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="User not found")
    return serialize(doc)


@app.post("/users/{user_id}/plans", status_code=201)
async def create_plan(user_id: str, body: PlanCreate):
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    plan = {"id": str(uuid.uuid4()), "title": body.title, "status": "active"}
    plans = user.get("plans", []) + [plan]
    await db.users.update_one({"_id": user_id}, {"$set": {"plans": plans}})
    return plan


@app.post("/users/{user_id}/links")
async def update_links(user_id: str, body: Links):
    """Sets the logged-in user's own profile links (LinkedIn, Instagram,
    Facebook, ...), entered manually post-login rather than pulled from a
    specific social login provider. Merges into existing links -- an
    omitted field here leaves that link untouched."""
    db = get_db()
    user = await db.users.find_one({"_id": user_id})
    if user is None:
        raise HTTPException(status_code=404, detail="User not found")
    merged = {**user.get("links", {}), **body.model_dump(exclude_none=True)}
    await db.users.update_one({"_id": user_id}, {"$set": {"links": merged}})
    updated = await db.users.find_one({"_id": user_id})
    return serialize(updated)


async def _run_enrichment(connection_id: str):
    db = get_db()
    connection = await db.connections.find_one({"_id": connection_id})
    if connection is None:
        return
    user = await db.users.find_one({"_id": connection["owner_id"]})
    user_goals = [p["title"] for p in user["plans"]] if user else []

    result = await enrich_and_generate_quests(
        person=connection["person"],
        met_context=connection["met"],
        notes=connection["notes"],
        user_goals=user_goals,
    )
    # agent/ returns enrichment as {"facts": [...]} (see agent/README.md §3);
    # the shared data model's Enrichment shape (root README.md §3) is
    # {role, interests, recent_activity, links} — translate here so this is
    # the only place that needs to know about the agent's raw output shape.
    enrichment = {
        "role": None,
        "interests": [],
        "recent_activity": result["enrichment"]["facts"],
        "links": {},
    }
    await db.connections.update_one({"_id": connection_id}, {"$set": {"enrichment": enrichment}})

    for q in result["quests"]:
        due_days = q.get("due_days")
        await db.quests.insert_one(
            {
                "owner_id": connection["owner_id"],
                "connection_id": connection_id,
                "type": q["action_type"],
                "title": q["title"],
                "why_now": q["why_now"],
                "draft_message": q.get("draft_message"),
                "status": "pending",
                "plan_id": None,
                "xp": 10,
                "due_at": due_at_from_days(due_days),
            }
        )


@app.post("/connections", status_code=201)
async def create_connection(body: ConnectionCreate, background_tasks: BackgroundTasks):
    db = get_db()
    person_dict = body.person.model_dump(exclude_none=True)

    # Same person, scanned or typed again: merge into the existing
    # connection instead of creating a duplicate card. Matched by name
    # (case-insensitive) or any shared link URL.
    existing_docs = await db.connections.find({"owner_id": body.owner_id})
    match = find_existing_connection(existing_docs, person_dict)
    if match is not None:
        merged_person = {**match["person"], "links": {**match["person"].get("links", {}), **person_dict.get("links", {})}}
        await db.connections.update_one(
            {"_id": match["_id"]},
            {"$set": {"person": merged_person, "notes": match["notes"] + body.notes, "last_touch": now_iso()}},
        )
        doc = await db.connections.find_one({"_id": match["_id"]})
        result = serialize(doc)
        result["warmth"] = warmth_for_connection(doc)
        result["merged"] = True
        xp_result = await award_xp(db, body.owner_id, CONNECTION_XP)
        if xp_result:
            result.update(xp_result)
        return result

    doc = await db.connections.insert_one(
        {
            "owner_id": body.owner_id,
            "person": person_dict,
            "met": body.met.model_dump(exclude_none=True),
            "notes": body.notes,
            "enrichment": None,
            "last_touch": now_iso(),
        }
    )
    connection_id = doc["_id"]

    if demo_mode():
        await db.connections.update_one({"_id": connection_id}, {"$set": {"enrichment": DEMO_ENRICHMENT}})
        for q in DEMO_QUESTS:
            await db.quests.insert_one(
                {
                    "owner_id": body.owner_id,
                    "connection_id": connection_id,
                    "type": q["type"],
                    "title": q["title"],
                    "why_now": q["why_now"],
                    "draft_message": q["draft_message"],
                    "status": "pending",
                    "plan_id": None,
                    "xp": q["xp"],
                    "due_at": due_at_from_days(q.get("due_days")),
                }
            )
        doc = await db.connections.find_one({"_id": connection_id})
    else:
        background_tasks.add_task(_run_enrichment, connection_id)

    result = serialize(doc)
    result["warmth"] = warmth_for_connection(doc)
    result["merged"] = False

    # Adding a connection is itself an XP-awarding, streak-building action
    # -- "the score goes up when you leave the app" starts here, not only
    # at quest completion.
    xp_result = await award_xp(db, body.owner_id, CONNECTION_XP)
    if xp_result:
        result.update(xp_result)

    return result


@app.get("/connections/{connection_id}")
async def get_connection(connection_id: str):
    db = get_db()
    doc = await db.connections.find_one({"_id": connection_id})
    if doc is None:
        raise HTTPException(status_code=404, detail="Connection not found")
    quests = await db.quests.find({"connection_id": connection_id})
    result = serialize(doc)
    result["warmth"] = warmth_for_connection(doc)
    result["quests"] = [serialize(q) for q in quests]
    return result


@app.get("/connections")
async def list_connections(owner_id: str):
    db = get_db()
    docs = await db.connections.find({"owner_id": owner_id})
    results = []
    for doc in docs:
        item = serialize(doc)
        item["warmth"] = warmth_for_connection(doc)
        results.append(item)
    return results


@app.get("/quests")
async def list_quests(owner_id: str):
    """All follow-up tasks for a user across every connection — the
    dashboard's main feed, independent of which connection they came from."""
    db = get_db()
    quests = await db.quests.find({"owner_id": owner_id})
    return [serialize(q) for q in quests]


@app.post("/quests/{quest_id}/link-plan")
async def link_quest_to_plan(quest_id: str, body: LinkQuestToPlan):
    db = get_db()
    quest = await db.quests.find_one({"_id": quest_id})
    if quest is None:
        raise HTTPException(status_code=404, detail="Quest not found")
    if body.plan_id is not None:
        user = await db.users.find_one({"_id": quest["owner_id"]})
        if user is None or not any(p["id"] == body.plan_id for p in user.get("plans", [])):
            raise HTTPException(status_code=404, detail="Plan not found")
    await db.quests.update_one({"_id": quest_id}, {"$set": {"plan_id": body.plan_id}})
    updated = await db.quests.find_one({"_id": quest_id})
    return serialize(updated)


@app.post("/quests/{quest_id}/complete")
async def complete_quest(quest_id: str):
    db = get_db()
    quest = await db.quests.find_one({"_id": quest_id})
    if quest is None:
        raise HTTPException(status_code=404, detail="Quest not found")
    if quest["status"] == "completed":
        raise HTTPException(status_code=400, detail="Quest already completed")

    await db.quests.update_one({"_id": quest_id}, {"$set": {"status": "completed"}})
    await db.connections.update_one({"_id": quest["connection_id"]}, {"$set": {"last_touch": now_iso()}})

    xp_result = await award_xp(db, quest["owner_id"], quest["xp"])

    updated_quest = await db.quests.find_one({"_id": quest_id})
    result = {"quest": serialize(updated_quest)}
    result.update(xp_result or {"xp_awarded": quest["xp"], "new_total_xp": quest["xp"], "streak": 0})
    return result
