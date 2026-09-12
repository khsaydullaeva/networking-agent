"""Pre-written enrichment/quests served instantly by DEMO_MODE, so a demo
never depends on venue wifi or the LLM provider being reachable."""

DEMO_ENRICHMENT = {
    "role": "Software Engineer",
    "interests": ["machine learning", "distributed systems"],
    "recent_activity": [
        {
            "fact": "Posted a write-up on sparse routing for LLM inference three weeks ago.",
            "source_url": "https://example.com/sparse-routing",
            "date": None,
        }
    ],
    "links": {},
}

DEMO_QUESTS = [
    {
        "type": "message",
        "title": "Send a follow-up about their sparse routing work",
        "why_now": "Their write-up on sparse routing (posted 3 weeks ago) relates "
        "directly to what you discussed — ask how their approach compares.",
        "draft_message": "Hey! Loved hearing about your sparse routing work — would love to dig in more.",
        "xp": 10,
    },
    {
        "type": "read",
        "title": "Read their sparse routing write-up",
        "why_now": "You can reference specifics from it next time you talk.",
        "draft_message": None,
        "xp": 5,
    },
]
