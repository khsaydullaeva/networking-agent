"""The only file in backend/ that touches agent/. A local Python import
(agent/ as a sibling package, repo root added to sys.path) avoids the
overhead of a second HTTP hop for a hackathon — switch to a network call
here later if the agent team wants process isolation, without touching
any caller of enrich_and_generate_quests below."""

import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from agent import enrich_and_generate_quests as _enrich_and_generate_quests  # noqa: E402

FALLBACK_RESULT = {
    "enrichment": {"role": None, "interests": [], "recent_activity": [], "links": {}},
    "quests": [
        {
            "title": "Send a follow-up message",
            "why_now": "You just connected — a quick note while it's fresh keeps the door open.",
            "action_type": "message",
            "draft_message": "Great meeting you! Would love to stay in touch.",
            "due_days": 3,
        }
    ],
}


async def enrich_and_generate_quests(person: dict, met_context: dict, notes: list[str], user_goals: list[str]) -> dict:
    """Calls agent/, degrading to a single generic fallback quest on any
    failure or timeout rather than blocking the connection from appearing."""
    try:
        return await _enrich_and_generate_quests(person, met_context, notes, user_goals)
    except Exception:
        return FALLBACK_RESULT
