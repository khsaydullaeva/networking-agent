"""API tests run against DEMO_MODE (zero network calls to the agent's LLM
or link fetching) and the in-memory db fallback (no Atlas needed).

Run with: DEMO_MODE=true python -m pytest backend/tests/test_api.py -v
"""

import os

os.environ["DEMO_MODE"] = "true"

import pytest
from fastapi.testclient import TestClient

from backend.app import db as db_module
from backend.app.auth import verify_token
from backend.app.main import app


@pytest.fixture(autouse=True)
def fresh_db():
    db_module._db = None
    yield
    db_module._db = None


@pytest.fixture
def client():
    return TestClient(app)


def test_create_user(client):
    resp = client.post("/users", json={"name": "Alice", "goals": ["ML internship"], "links": {}})
    assert resp.status_code == 201
    body = resp.json()
    assert body["name"] == "Alice"
    assert body["xp"] == 0
    assert body["plans"] == [{"id": body["plans"][0]["id"], "title": "ML internship", "status": "active"}]


def test_add_plan_to_user(client):
    user = client.post("/users", json={"name": "Alice", "goals": [], "links": {}}).json()
    resp = client.post(f"/users/{user['id']}/plans", json={"title": "Land a robotics internship"})
    assert resp.status_code == 201
    plan = resp.json()
    assert plan["title"] == "Land a robotics internship"
    assert plan["status"] == "active"

    fetched = client.get(f"/users/{user['id']}").json()
    assert len(fetched["plans"]) == 1
    assert fetched["plans"][0]["id"] == plan["id"]


def test_update_own_profile_links_merges_partial(client):
    user = client.post("/users", json={"name": "Alice", "goals": [], "links": {}}).json()

    first = client.post(f"/users/{user['id']}/links", json={"linkedin": "https://linkedin.com/in/alice"})
    assert first.status_code == 200
    assert first.json()["links"]["linkedin"] == "https://linkedin.com/in/alice"

    # setting instagram shouldn't clobber the linkedin set above
    second = client.post(f"/users/{user['id']}/links", json={"instagram": "https://instagram.com/alice"})
    assert second.status_code == 200
    links = second.json()["links"]
    assert links["linkedin"] == "https://linkedin.com/in/alice"
    assert links["instagram"] == "https://instagram.com/alice"


def test_list_quests_and_link_to_plan(client):
    user = client.post("/users", json={"name": "Bob", "goals": ["Cofounder"], "links": {}}).json()
    plan_id = user["plans"][0]["id"]
    client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "P", "org": "", "links": {}},
            "met": {"context_type": "work"},
            "notes": [],
        },
    )

    quests = client.get(f"/quests?owner_id={user['id']}").json()
    assert len(quests) >= 1
    quest_id = quests[0]["id"]

    resp = client.post(f"/quests/{quest_id}/link-plan", json={"plan_id": plan_id})
    assert resp.status_code == 200
    assert resp.json()["plan_id"] == plan_id

    # linking to a plan that doesn't exist is rejected
    bad = client.post(f"/quests/{quest_id}/link-plan", json={"plan_id": "nonexistent"})
    assert bad.status_code == 404

    # unlinking (plan_id: null) is allowed
    unlink = client.post(f"/quests/{quest_id}/link-plan", json={"plan_id": None})
    assert unlink.status_code == 200
    assert unlink.json()["plan_id"] is None


def test_auth_session_gets_or_creates_user_by_auth0_sub(client):
    """Doesn't hit real Auth0 — verify_token is overridden to simulate an
    already-verified ID token, so this exercises the get-or-create logic
    in isolation from JWKS/network verification."""
    app.dependency_overrides[verify_token] = lambda: {"sub": "auth0|abc123", "name": "Priya"}
    try:
        first = client.post("/auth/session")
        assert first.status_code == 200
        body = first.json()
        assert body["name"] == "Priya"
        assert body["auth0_id"] == "auth0|abc123"
        assert body["plans"] == []

        second = client.post("/auth/session")
        assert second.status_code == 200
        assert second.json()["id"] == body["id"]  # same user returned, not duplicated
    finally:
        app.dependency_overrides.pop(verify_token, None)


def test_auth_session_without_token_is_rejected(client):
    resp = client.post("/auth/session")
    assert resp.status_code == 401


def test_create_connection_returns_immediately_with_demo_enrichment(client):
    user = client.post("/users", json={"name": "Bob", "goals": [], "links": {}}).json()

    resp = client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "Ava Chen", "org": "CMU", "links": {}},
            "met": {"lat": 0.0, "lng": 0.0, "context_type": "conference"},
            "notes": ["met at career fair"],
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["enrichment"] is not None  # DEMO_MODE fills this in synchronously
    assert "warmth" in body


def test_get_connection_includes_quests(client):
    user = client.post("/users", json={"name": "Cara", "goals": [], "links": {}}).json()
    conn = client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "Marcus Reyes", "org": "Querit", "links": {}},
            "met": {"context_type": "work"},
            "notes": [],
        },
    ).json()

    resp = client.get(f"/connections/{conn['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["enrichment"] is not None
    assert len(body["quests"]) >= 1


def test_list_connections_by_owner(client):
    user = client.post("/users", json={"name": "Dee", "goals": [], "links": {}}).json()
    client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "P1", "org": "", "links": {}},
            "met": {"context_type": "campus"},
            "notes": [],
        },
    )
    client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "P2", "org": "", "links": {}},
            "met": {"context_type": "club"},
            "notes": [],
        },
    )

    resp = client.get(f"/connections?owner_id={user['id']}")
    assert resp.status_code == 200
    assert len(resp.json()) == 2


def test_connection_and_quest_completion_both_award_xp_and_streak(client):
    user = client.post("/users", json={"name": "Eve", "goals": [], "links": {}}).json()
    assert user["xp"] == 0
    assert user["streak"] == 0

    conn = client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "P3", "org": "", "links": {}},
            "met": {"context_type": "conference"},
            "notes": [],
        },
    ).json()
    # adding a connection is itself an XP-awarding, streak-starting action
    assert conn["xp_awarded"] > 0
    assert conn["new_total_xp"] == conn["xp_awarded"]
    assert conn["streak"] == 1
    xp_after_connection = conn["new_total_xp"]

    quest_id = conn["quests"][0]["id"] if "quests" in conn else client.get(f"/connections/{conn['id']}").json()["quests"][0]["id"]

    resp = client.post(f"/quests/{quest_id}/complete")
    assert resp.status_code == 200
    body = resp.json()
    assert body["quest"]["status"] == "completed"
    assert body["xp_awarded"] > 0
    # stacks on top of the connection-creation XP, doesn't replace it
    assert body["new_total_xp"] == xp_after_connection + body["xp_awarded"]
    # same UTC day as the connection -> streak doesn't double-increment
    assert body["streak"] == 1

    # completing twice should fail cleanly
    resp2 = client.post(f"/quests/{quest_id}/complete")
    assert resp2.status_code == 400


@pytest.mark.anyio
async def test_run_enrichment_translates_agent_facts_to_shared_shape(monkeypatch):
    """agent/ returns enrichment as {"facts": [...]} (agent/README.md §3),
    but the shared Enrichment model (root README.md §3) is
    {role, interests, recent_activity, links}. Regression test for a bug
    where the real (non-demo) path stored the raw agent shape directly,
    so mobile's `enrichment.interests.length` crashed on undefined."""
    from backend.app import main as main_module

    db_module._db = None
    db = db_module.get_db()
    user = await db.users.insert_one({"name": "U", "plans": [], "xp": 0})
    conn = await db.connections.insert_one(
        {
            "owner_id": user["_id"],
            "person": {"name": "P", "org": "", "links": {}},
            "met": {"context_type": "conference"},
            "notes": [],
            "enrichment": None,
            "last_touch": None,
        }
    )

    async def fake_enrich(**kwargs):
        return {
            "enrichment": {"facts": [{"fact": "did a thing", "source_url": "https://x.com", "date": None}]},
            "quests": [],
        }

    monkeypatch.setattr(main_module, "enrich_and_generate_quests", fake_enrich)

    await main_module._run_enrichment(conn["_id"])

    stored = await db.connections.find_one({"_id": conn["_id"]})
    assert stored["enrichment"]["recent_activity"] == [
        {"fact": "did a thing", "source_url": "https://x.com", "date": None}
    ]
    assert stored["enrichment"]["interests"] == []
    assert stored["enrichment"]["role"] is None


@pytest.fixture
def anyio_backend():
    return "asyncio"


def test_warmth_differs_by_context_type(client):
    user = client.post("/users", json={"name": "Fay", "goals": [], "links": {}}).json()
    work_conn = client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "W", "org": "", "links": {}},
            "met": {"context_type": "work"},
            "notes": [],
        },
    ).json()
    conf_conn = client.post(
        "/connections",
        json={
            "owner_id": user["id"],
            "person": {"name": "C", "org": "", "links": {}},
            "met": {"context_type": "conference"},
            "notes": [],
        },
    ).json()

    assert work_conn["warmth"] > conf_conn["warmth"]
