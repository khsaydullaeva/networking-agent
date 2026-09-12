import asyncio
import json

from .link_fetch import fetch_link_preview
from .llm.factory import get_llm
from .prompts import EXTRACT_FACTS_PROMPT
from .retry import with_one_retry
from .schemas import FACTS_SCHEMA

MAX_FACTS = 6


async def enrich(person: dict, met_context: dict) -> dict:
    """Extracts facts from the profile links the person shared (LinkedIn,
    Instagram, Facebook, ...) — no generic web search by name. If they
    didn't share any links, there's nothing to enrich from and this
    returns no facts; the mobile connect screen is where links get
    captured (root README.md §1).

    Never raises: a fetch or LLM failure for one link just means fewer
    facts, not a broken connection.
    """
    links = [url for url in person.get("links", {}).values() if url]
    if not links:
        return {"facts": []}

    llm = get_llm()

    previews = await asyncio.gather(*[fetch_link_preview(u) for u in links], return_exceptions=True)
    clean_previews = [p for p in previews if isinstance(p, dict)]
    if not clean_previews:
        return {"facts": []}

    facts: list[dict] = []
    for preview in clean_previews:
        extracted = await with_one_retry(
            lambda p=preview: llm.generate_json(
                system_prompt=EXTRACT_FACTS_PROMPT,
                user_prompt=json.dumps({"query": p["url"], "results": [p]}),
                schema=FACTS_SCHEMA,
            ),
            fallback={"facts": []},
        )
        facts.extend(extracted["facts"])

    # HARD RULE: never trust the LLM's self-reported source_url — verify it
    # is one of the links we actually fetched.
    known_urls = {p["url"] for p in clean_previews}
    verified = [f for f in facts if f["source_url"] in known_urls]

    return {"facts": verified[:MAX_FACTS]}
