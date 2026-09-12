import math
from datetime import datetime, timezone

CONTEXT_WEIGHT = {
    "work": 0.9,
    "club": 0.9,
    "conference": 0.5,
    "orientation": 0.5,
    "campus": 0.6,
    "other": 0.5,
}

TAU_DAYS = 14  # tune during testing — controls how fast warmth decays


def compute_warmth(last_touch_days: float, interaction_count: int, context_weight: float) -> float:
    recency = math.exp(-last_touch_days / TAU_DAYS)
    frequency = math.log(1 + interaction_count) / math.log(10)  # normalize roughly to 0-1
    return max(0.0, min(1.0, 0.5 * recency + 0.3 * frequency + 0.2 * context_weight))


def warmth_for_connection(connection: dict) -> float:
    last_touch = connection.get("last_touch")
    if last_touch:
        last_touch_dt = datetime.fromisoformat(last_touch.replace("Z", "+00:00"))
        days = max(0.0, (datetime.now(timezone.utc) - last_touch_dt).total_seconds() / 86400)
    else:
        days = 0.0
    interaction_count = len(connection.get("notes", [])) + 1
    context_weight = CONTEXT_WEIGHT.get(connection.get("met", {}).get("context_type", "other"), 0.5)
    return compute_warmth(days, interaction_count, context_weight)
