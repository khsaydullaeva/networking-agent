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
    search_results = json.loads((FIXTURES_DIR / "fake_search_results.json").read_text())
    return people, search_results


@pytest.fixture(autouse=True)
def patch_llm(monkeypatch):
    monkeypatch.setattr(enrichment, "get_llm", lambda: FakeLLMProvider())
    monkeypatch.setattr(quests, "get_llm", lambda: FakeLLMProvider())


@pytest.fixture(autouse=True)
def patch_querit(monkeypatch):
    _, search_results = load_fixtures()

    async def fake_search(query: str):
        # Every fixture query returns the same result set for its person in
        # this simplified harness — good enough to validate the pipeline
        # shape end-to-end without a real Querit call.
        return search_results.get(fake_search.current_person, [])

    monkeypatch.setattr(enrichment, "querit_search", fake_search)
    fake_search.current_person = None
    return fake_search


@pytest.mark.anyio
async def test_at_least_three_of_five_profiles_produce_specific_quests(patch_querit):
    people, _ = load_fixtures()
    specific_count = 0

    for entry in people:
        person = entry["person"]
        patch_querit.current_person = person["name"]

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


@pytest.fixture
def anyio_backend():
    return "asyncio"
