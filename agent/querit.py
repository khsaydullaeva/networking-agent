import os

import httpx

QUERIT_URL = "https://api.querit.ai/v1/search"


async def querit_search(query: str) -> list[dict]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.post(
            QUERIT_URL,
            headers={"Authorization": f"Bearer {os.environ['QUERIT_API_KEY']}"},
            json={"query": query, "count": 5},
        )
        resp.raise_for_status()
        return resp.json()["results"]["result"]
