from .enrichment import enrich
from .quests import generate_quests


async def enrich_and_generate_quests(
    person: dict, met_context: dict, notes: list[str], user_goals: list[str]
) -> dict:
    """Stateless entry point called by backend/. Takes a connection's data
    in, returns enrichment + quests out. Writes nothing to any DB.

    person: {"name": str, "org": str, "links": {...}}
    met_context: {"lat": float, "lng": float, "place_label": str,
                  "ts": str, "context_type": str}
    notes: list[str] (typed or transcribed voice notes; currently unused by
           the pipelines below but threaded through for future prompts)
    user_goals: list[str]
    """
    enrichment = await enrich(person, met_context)
    quest_result = await generate_quests(person, enrichment, met_context, user_goals)
    return {"enrichment": enrichment, "quests": quest_result["quests"]}
