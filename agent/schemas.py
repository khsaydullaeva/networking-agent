QUERY_PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "queries": {
            "type": "array",
            "minItems": 1,
            "maxItems": 3,
            "items": {"type": "string"},
        }
    },
    "required": ["queries"],
}

FACTS_SCHEMA = {
    "type": "object",
    "properties": {
        "facts": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "fact": {"type": "string"},
                    "source_url": {"type": "string"},
                    "date": {"type": ["string", "null"]},
                },
                "required": ["fact", "source_url"],
            },
        }
    },
    "required": ["facts"],
}

QUEST_SCHEMA = {
    "type": "object",
    "properties": {
        "quests": {
            "type": "array",
            "maxItems": 3,
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "why_now": {"type": "string"},
                    "action_type": {"enum": ["message", "read", "meet", "share"]},
                    "draft_message": {"type": ["string", "null"]},
                    "due_days": {"type": "integer"},
                },
                "required": ["title", "why_now", "action_type", "due_days"],
            },
        }
    },
    "required": ["quests"],
}
