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


async def generate_quests(person: dict, enrichment: dict, met_context: dict, user_goals: list[str]) -> dict:
    llm = get_llm()
    return await with_one_retry(
        lambda: llm.generate_json(
            system_prompt=QUEST_GEN_PROMPT,
            user_prompt=json.dumps(
                {
                    "person": person,
                    "facts": enrichment["facts"],
                    "met_context": met_context,
                    "user_goals": user_goals,
                }
            ),
            schema=QUEST_SCHEMA,
        ),
        fallback=FALLBACK_QUESTS,
    )
