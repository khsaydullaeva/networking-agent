"""A deterministic, network-free stand-in for a real LLM provider, used to
exercise both pipelines end-to-end against the fixtures in agent/fixtures/
without needing LLM_API_KEY set.

It fakes "understanding" by keying off which schema it's asked to fill,
and returns plausible, well-formed output for that step.
"""

from agent.llm.base import LLMProvider


class FakeLLMProvider(LLMProvider):
    async def generate_json(self, system_prompt: str, user_prompt: str, schema: dict) -> dict:
        properties = schema.get("properties", {})

        if "facts" in properties:
            import json as _json

            payload = _json.loads(user_prompt)
            results = payload["results"]
            return {
                "facts": [
                    {
                        "fact": r["snippet"],
                        "source_url": r["url"],
                        "date": None,
                    }
                    for r in results
                ]
            }

        if "quests" in properties:
            import json as _json

            payload = _json.loads(user_prompt)
            facts = payload["facts"]
            quests = []
            for f in facts[:3]:
                quests.append(
                    {
                        "title": f"Follow up on: {f['fact'][:40]}",
                        "why_now": f"They recently: {f['fact']} (source: {f['source_url']})",
                        "action_type": "message",
                        "draft_message": f"Hey! Saw your work — {f['fact']} Would love to hear more.",
                        "due_days": 5,
                    }
                )
            return {"quests": quests}

        raise ValueError(f"FakeLLMProvider doesn't know how to handle schema: {schema}")
