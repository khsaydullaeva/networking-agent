import json

from .llm.factory import get_llm
from .prompts import QUEST_GEN_PROMPT
from .retry import with_one_retry
from .schemas import QUEST_SCHEMA

FALLBACK_QUESTS = {
    "quests": [
        {
            "title": "Send a follow-up message",
            "why_now": "You just connected — a quick note while it's fresh keeps the door open.",
            "action_type": "message",
            "draft_message": "Great meeting you! Would love to stay in touch.",
            "due_days": 3,
        }
    ]
}


async def generate_quests(
    person: dict, enrichment: dict, met_context: dict, user_goals: list[str], notes: list[str] | None = None
) -> dict:
    notes = notes or []
    facts = enrichment.get("facts") or []

    # With nothing to cite -- no facts, no notes -- the quest-gen prompt's
    # hard rule leaves the LLM nothing to write, and it correctly returns
    # zero quests rather than inventing a reason. That's right for the LLM,
    # wrong for the product: every connection should still get something
    # actionable, so skip straight to the generic fallback instead of
    # spending a call on a foregone empty result.
    if not facts and not notes:
        return FALLBACK_QUESTS

    llm = get_llm()
    return await with_one_retry(
        lambda: llm.generate_json(
            system_prompt=QUEST_GEN_PROMPT,
            user_prompt=json.dumps(
                {
                    "person": person,
                    "facts": facts,
                    "notes": notes,
                    "met_context": met_context,
                    "user_goals": user_goals,
                }
            ),
            schema=QUEST_SCHEMA,
        ),
        fallback=FALLBACK_QUESTS,
    )
