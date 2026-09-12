import asyncio
import json

from .llm.factory import get_llm
from .prompts import EXTRACT_FACTS_PROMPT, PLAN_QUERIES_PROMPT
from .querit import querit_search
from .retry import with_one_retry
from .schemas import FACTS_SCHEMA, QUERY_PLAN_SCHEMA

MAX_FACTS = 6


async def enrich(person: dict, met_context: dict) -> dict:
    """Searches the web for `person` and returns verified, sourced facts.

    Never raises: LLM failures fall back to an empty query plan / fact list
    so a bad LLM response degrades enrichment quality, not availability.
    """
    llm = get_llm()

    queries = await with_one_retry(
        lambda: llm.generate_json(
            system_prompt=PLAN_QUERIES_PROMPT,
            user_prompt=json.dumps({"person": person, "context": met_context}),
            schema=QUERY_PLAN_SCHEMA,
        ),
        fallback={"queries": []},
    )

    # Any profile links the user typed in manually (LinkedIn, Instagram,
    # Facebook, ...) are searched directly too, so enrichment can ground
    # facts in the specific profile provided rather than only guessing
    # from name + org. These flow through the same verification below as
    # ordinary queries — a provided link is a lead, not a trusted source.
    link_queries = [url for url in person.get("links", {}).values() if url]
    all_queries = queries["queries"] + link_queries
    if not all_queries:
        return {"facts": []}

    results = await asyncio.gather(
        *[querit_search(q) for q in all_queries], return_exceptions=True
    )
    # A failed search for one query shouldn't sink the others.
    clean_results = [r if isinstance(r, list) else [] for r in results]

    facts: list[dict] = []
    for query, result_set in zip(all_queries, clean_results):
        if not result_set:
            continue
        extracted = await with_one_retry(
            lambda q=query, rs=result_set: llm.generate_json(
                system_prompt=EXTRACT_FACTS_PROMPT,
                user_prompt=json.dumps({"query": q, "results": rs}),
                schema=FACTS_SCHEMA,
            ),
            fallback={"facts": []},
        )
        facts.extend(extracted["facts"])

    # HARD RULE: never trust the LLM's self-reported source_url — verify it
    # appears in the search results actually retrieved.
    known_urls = {r["url"] for rs in clean_results for r in rs}
    verified = [f for f in facts if f["source_url"] in known_urls]

    return {"facts": verified[:MAX_FACTS]}
