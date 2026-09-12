import os
from datetime import datetime, timezone

from fastapi import BackgroundTasks, FastAPI, HTTPException

from .agent_client import enrich_and_generate_quests
from .db import get_db, serialize
from .demo_fixtures import DEMO_ENRICHMENT, DEMO_QUESTS
from .models import ConnectionCreate, UserCreate
from .warmth import warmth_for_connection

app = FastAPI(title="Networking Agent Backend")


def demo_mode() -> bool:
    return os.environ.get("DEMO_MODE", "").lower() in ("1", "true", "yes")


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@app.post("/users", status_code=201)
async def create_user(body: UserCreate):
    db = get_db()
    doc = await db.users.insert_one(
        {
            "name": body.name,
            "goals": body.goals,
            "links": body.links.model_dump(exclude_none=True),
            "auth0_id": None,
            "xp": 0,
            "streak": 0,
        }
    )
    return serialize(doc)


async def _run_enrichment(connection_id: str):
    db = get_db()
    connection = await db.connections.find_one({"_id": connection_id})
    if connection is None:
        return
    user = await db.users.find_one({"_id": connection["owner_id"]})
    user_goals = user["goals"] if user else []

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
        await db.quests.insert_one(
            {
                "owner_id": connection["owner_id"],
                "connection_id": connection_id,
                "type": q["action_type"],
                "title": q["title"],
                "why_now": q["why_now"],
                "draft_message": q.get("draft_message"),
                "status": "pending",
                "xp": 10,
                "due_at": None,
            }
        )


@app.post("/connections", status_code=201)
async def create_connection(body: ConnectionCreate, background_tasks: BackgroundTasks):
    db = get_db()
    doc = await db.connections.insert_one(
        {
            "owner_id": body.owner_id,
            "person": body.person.model_dump(exclude_none=True),
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
                    "xp": q["xp"],
                    "due_at": None,
                }
            )
        doc = await db.connections.find_one({"_id": connection_id})
    else:
        background_tasks.add_task(_run_enrichment, connection_id)

    result = serialize(doc)
    result["warmth"] = warmth_for_connection(doc)
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

    user = await db.users.find_one({"_id": quest["owner_id"]})
    new_total_xp = (user["xp"] if user else 0) + quest["xp"]
    if user is not None:
        await db.users.update_one({"_id": quest["owner_id"]}, {"$set": {"xp": new_total_xp}})

    updated_quest = await db.quests.find_one({"_id": quest_id})
    return {
        "quest": serialize(updated_quest),
        "xp_awarded": quest["xp"],
        "new_total_xp": new_total_xp,
    }
