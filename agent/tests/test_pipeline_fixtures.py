"""End-to-end pipeline test against fixtures, with zero real network calls.

Run with: python -m pytest agent/tests/test_pipeline_fixtures.py -v
"""

import json
from pathlib import Path

import pytest

from agent import enrichment, quests
from agent.tests.fake_llm import FakeLLMProvider

FIXTURES_DIR = Path(__file__).parent.parent / "fixtures"


def load_fixtures():
    people = json.loads((FIXTURES_DIR / "fake_people.json").read_text())
    link_previews = json.loads((FIXTURES_DIR / "fake_link_previews.json").read_text())
    return people, link_previews


@pytest.fixture(autouse=True)
def patch_llm(monkeypatch):
    monkeypatch.setattr(enrichment, "get_llm", lambda: FakeLLMProvider())
    monkeypatch.setattr(quests, "get_llm", lambda: FakeLLMProvider())


@pytest.fixture(autouse=True)
def patch_link_fetch(monkeypatch):
    _, link_previews = load_fixtures()

    async def fake_fetch(url: str):
        preview = link_previews.get(url)
        return {"url": url, **preview} if preview else None

    monkeypatch.setattr(enrichment, "fetch_link_preview", fake_fetch)


@pytest.mark.anyio
async def test_at_least_three_of_five_profiles_produce_specific_quests():
    people, _ = load_fixtures()
    specific_count = 0

    for entry in people:
        person = entry["person"]

        enrichment_result = await enrichment.enrich(
            person, {"context_type": "conference", "place_label": "Career Fair"}
        )
        assert enrichment_result["facts"], f"no facts for {person['name']}"

        quest_result = await quests.generate_quests(
            person, enrichment_result, {"context_type": "conference"}, ["ML internship"]
        )
        assert quest_result["quests"]
        for q in quest_result["quests"]:
            # the hard rule: why_now must reference a specific fact, not be generic
            assert any(
                fact["fact"][:15] in q["why_now"] for fact in enrichment_result["facts"]
            )
        specific_count += 1

    assert specific_count >= 3


@pytest.mark.anyio
async def test_no_links_means_no_facts():
    """The whole point of the links-only pipeline: a contact with no
    shared links gets no enrichment, not a generic name-based guess."""
    result = await enrichment.enrich(
        {"name": "Nobody Given Links", "org": "", "links": {}},
        {"context_type": "other"},
    )
    assert result["facts"] == []


@pytest.mark.anyio
async def test_no_facts_still_yields_a_fallback_quest():
    """Zero facts (no links, or links that couldn't be fetched) must not
    leave the connection with nothing to do -- regression test for the
    dead-end screen this produced before the fallback in quests.py."""
    result = await quests.generate_quests(
        person={"name": "Nobody Given Links", "org": ""},
        enrichment={"facts": []},
        met_context={"context_type": "other"},
        user_goals=[],
    )
    assert len(result["quests"]) == 1
    assert result["quests"][0]["action_type"] == "message"


@pytest.mark.anyio
async def test_notes_alone_ground_a_quest_without_any_facts():
    """A contact with no shared links (so no enrichment facts) but a note
    like a meeting commitment should still get a real, specific quest --
    not the generic fallback -- because notes are a valid citation source
    now too (agent/prompts.py QUEST_GEN_PROMPT)."""
    result = await quests.generate_quests(
        person={"name": "Harsh", "org": ""},
        enrichment={"facts": []},
        met_context={"context_type": "conference"},
        user_goals=[],
        notes=["do robotics project together, meet 2pm Monday"],
    )
    assert len(result["quests"]) == 1
    assert "robotics" in result["quests"][0]["why_now"].lower()


@pytest.fixture
def anyio_backend():
    return "asyncio"
