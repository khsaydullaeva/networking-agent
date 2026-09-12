"""Regression test: person.links (LinkedIn/Instagram/Facebook typed in
manually on the connect screen) must be searched directly, not just
guessed from name + org — and facts from them still go through the same
source verification as any other query."""

import pytest

from agent import enrichment
from agent.tests.fake_llm import FakeLLMProvider


@pytest.fixture(autouse=True)
def patch_llm(monkeypatch):
    monkeypatch.setattr(enrichment, "get_llm", lambda: FakeLLMProvider())


@pytest.mark.anyio
async def test_provided_links_are_searched_and_facts_verified(monkeypatch):
    seen_queries: list[str] = []

    async def fake_search(query: str):
        seen_queries.append(query)
        if query == "https://linkedin.com/in/janedoe":
            return [
                {
                    "url": "https://linkedin.com/in/janedoe",
                    "title": "Jane Doe",
                    "snippet": "Jane Doe is a robotics engineer at Acme.",
                }
            ]
        return []  # the LLM-planned queries find nothing in this test

    monkeypatch.setattr(enrichment, "querit_search", fake_search)

    result = await enrichment.enrich(
        person={
            "name": "Jane Doe",
            "org": "Acme",
            "links": {"linkedin": "https://linkedin.com/in/janedoe", "instagram": ""},
        },
        met_context={"context_type": "conference"},
    )

    assert "https://linkedin.com/in/janedoe" in seen_queries
    assert "" not in seen_queries  # empty link values are skipped, not searched
    assert any(f["source_url"] == "https://linkedin.com/in/janedoe" for f in result["facts"])


@pytest.fixture
def anyio_backend():
    return "asyncio"
